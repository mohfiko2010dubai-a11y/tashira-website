#!/usr/bin/python3
"""System disk alert. Python stdlib only; no application files or services."""
import datetime, fcntl, json, os, pathlib, shutil, sys, urllib.request, uuid

ROOT = pathlib.Path('/var/lib/tashira-maintenance')
CONFIG = pathlib.Path('/etc/tashira-disk-alert.json')

def decision(used, state, now):
    level = 'urgent' if used >= 90 else 'warning' if used >= 80 else 'healthy'
    previous = state.get('level', 'healthy')
    last = state.get('sent_at', 0)
    if level == 'healthy':
        return 'recovery' if previous != 'healthy' else None
    if previous == 'healthy' or (level == 'urgent' and previous != 'urgent') or now - last >= 86400:
        return level
    return None

def write_state(state):
    tmp = ROOT / 'alert-state.tmp'
    with open(tmp, 'w') as output:
        json.dump(state, output)
        output.flush()
        os.fsync(output.fileno())
    os.replace(tmp, ROOT / 'alert-state.json')

def send(config, kind, used, key):
    title = {'test':'TEST — independent disk alert', 'urgent':'URGENT — disk at or above 90%',
             'warning':'WARNING — disk at or above 80%', 'recovery':'RECOVERED — disk below 80%'}[kind]
    body = ('TASHIRA server disk monitoring\n\n' + title + '\nCurrent root filesystem usage: ' + str(used) +
            '%\nWarning: 80%. Urgent: 90%.\nAlerts repeat every 24 hours while breached; one recovery message follows.\n'
            'This sender runs under systemd independently of the website, PM2, database and application mailer.\n')
    if kind == 'test':
        body += '\nThis is the single requested delivery test, not an outage. Please confirm it arrived in Inbox, not Spam.\n'
    request = urllib.request.Request('https://api.resend.com/emails', data=json.dumps({
        'from':config['from'], 'to':[config['to']], 'subject':'[TASHIRA OPS] '+title, 'text':body}).encode(),
        headers={'Authorization':'Bearer '+config['api_key'], 'Content-Type':'application/json',
                 'Idempotency-Key':key, 'User-Agent':'Tashira-System-Disk-Monitor/1.0'}, method='POST')
    with urllib.request.urlopen(request, timeout=20) as response:
        result = json.load(response)
    if not result.get('id'):
        raise RuntimeError('Provider did not acknowledge a message ID')
    return result['id']

def main():
    ROOT.mkdir(mode=0o750, exist_ok=True)
    with open(ROOT/'alert.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        config=json.loads(CONFIG.read_text())
        state_path=ROOT/'alert-state.json'
        state=json.loads(state_path.read_text()) if state_path.exists() else {}
        usage=shutil.disk_usage('/')
        used=int(100*usage.used/usage.total + 0.999)
        now=int(datetime.datetime.now(datetime.timezone.utc).timestamp())
        test='--test' in sys.argv
        if test and state.get('test_message_id'):
            print('TEST already accepted; no second email sent. Inbox confirmation still required.')
            return
        kind='test' if test else decision(used,state,now)
        if not kind:
            print('Disk '+str(used)+'%; no notification due.')
            return
        pending=state.get('pending')
        if not pending or pending['kind'] != kind:
            pending={'kind':kind,'key':'tashira-disk-'+str(uuid.uuid4()),'used':used}
            state['pending']=pending
            write_state(state)
        message_id=send(config,kind,pending['used'],pending['key'])
        state.pop('pending',None)
        if test:
            state['test_message_id']=message_id
        else:
            state.update(level='healthy' if kind=='recovery' else kind,sent_at=now)
        write_state(state)
        print(kind.upper()+' accepted by provider. Inbox placement is not confirmed by this response.')

if __name__ == '__main__':
    try: main()
    except Exception as error:
        # Do not log credentials or provider response bodies.
        print('DISK ALERT FAILED: '+type(error).__name__+'; retry next timer run.',file=sys.stderr)
        sys.exit(1)

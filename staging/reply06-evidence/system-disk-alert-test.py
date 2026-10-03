import importlib.util, unittest
spec=importlib.util.spec_from_file_location('alert','/usr/local/sbin/tashira-disk-alert.py')
alert=importlib.util.module_from_spec(spec);spec.loader.exec_module(alert)
class Decisions(unittest.TestCase):
    def test_thresholds(self):
        self.assertIsNone(alert.decision(79,{},1))
        self.assertEqual(alert.decision(80,{},1),'warning')
        self.assertEqual(alert.decision(90,{},1),'urgent')
    def test_daily(self):
        state={'level':'warning','sent_at':10}
        self.assertIsNone(alert.decision(85,state,86409))
        self.assertEqual(alert.decision(85,state,86410),'warning')
    def test_escalates_immediately(self):
        self.assertEqual(alert.decision(90,{'level':'warning','sent_at':10},11),'urgent')
    def test_recovery_once(self):
        self.assertEqual(alert.decision(79,{'level':'urgent','sent_at':10},11),'recovery')
        self.assertIsNone(alert.decision(79,{'level':'healthy','sent_at':11},12))
    def test_drop_still_breached(self):
        self.assertIsNone(alert.decision(85,{'level':'urgent','sent_at':10},11))
    def test_failure_not_acknowledged(self):
        self.assertEqual(alert.decision(85,{},11),'warning')
        self.assertEqual(alert.decision(85,{},12),'warning')
unittest.main()

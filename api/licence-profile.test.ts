import {describe,it,expect} from 'vitest';
import {expiryStatus} from '../contracts/licence-profile';
describe('licence expiry using Dubai calendar dates',()=>{
 it('does not present a lapsed licence as current',()=>{expect(expiryStatus('2027-12-01',new Date('2027-12-01T19:59:00Z')).status).toBe('current');expect(expiryStatus('2027-12-01',new Date('2027-12-01T20:00:00Z')).status).toBe('expired');});
});

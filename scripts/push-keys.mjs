import webpush from 'web-push';
import {randomBytes} from 'node:crypto';
const keys=webpush.generateVAPIDKeys();
console.log('AHF_VAPID_PUBLIC_KEY='+keys.publicKey+'\nAHF_VAPID_PRIVATE_KEY='+keys.privateKey+'\nAHF_PUSH_DISPATCH_SECRET='+randomBytes(32).toString('hex')+'\nAHF_VAPID_SUBJECT=mailto:YOUR_CONFIRMED_EMAIL');

// Deploy this optional separate Worker with a */5 * * * * cron trigger.
// Configure PUBLIC_ORIGIN and DISPATCH_SECRET as its secrets.
export const pushScheduler = {
  async scheduled(_controller: unknown, env: { PUBLIC_ORIGIN: string; DISPATCH_SECRET: string }) {
    const r = await fetch(env.PUBLIC_ORIGIN + '/api/push-dispatch', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.DISPATCH_SECRET },
    });
    if (!r.ok) throw Error('AHF push dispatch failed (' + r.status + ').');
  },
};

export default pushScheduler;

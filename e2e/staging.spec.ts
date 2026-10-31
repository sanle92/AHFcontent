import { test, expect, type APIRequestContext } from '@playwright/test';
type Session = { access_token: string; refresh_token: string; expires_at: number };
type Row = { id: string; version: number; status: string };
function session(name: string): Session {
  const value = JSON.parse(process.env[name] || 'null') as Session | null;
  if (
    !value ||
    typeof value.access_token !== 'string' ||
    typeof value.refresh_token !== 'string' ||
    typeof value.expires_at !== 'number'
  )
    throw Error('Provide two distinct, short-lived, MFA-verified staging sessions.');
  if (process.env.CI) {
    console.log('::add-mask::' + value.access_token);
    console.log('::add-mask::' + value.refresh_token);
  }
  return value;
}
async function post<T>(
  request: APIRequestContext,
  origin: string,
  actor: Session,
  path: string,
  data: unknown,
): Promise<T> {
  const response = await request.post(origin + '/api/' + path, {
    headers: { Authorization: 'Bearer ' + actor.access_token, Origin: origin },
    data,
  });
  expect(
    response.ok(),
    'Staging mutation must pass server authorization and validation',
  ).toBeTruthy();
  return response.json() as Promise<T>;
}
test('independent media approval synchronizes an open author editor and preserves its preview', async ({
  browser,
  request,
}) => {
  test.skip(
    !process.env.AHF_E2E_STAGING_ORIGIN || process.env.AHF_E2E_WRITES_ALLOWED !== 'yes',
    'Only explicitly authorized isolated staging projects may run this write test.',
  );
  const origin = new URL(process.env.AHF_E2E_STAGING_ORIGIN!).origin;
  expect(origin.startsWith('https://') || origin === 'http://127.0.0.1:4173').toBeTruthy();
  const author = session('AHF_E2E_AUTHOR_SESSION'),
    publisher = session('AHF_E2E_PUBLISHER_SESSION');
  expect(author.access_token === publisher.access_token).toBeFalsy();
  const authorProfile = (await (
    await request.get(origin + '/api/editorial?view=bootstrap', {
      headers: { Authorization: 'Bearer ' + author.access_token },
    })
  ).json()) as { profile: { id: string } };
  const publisherProfile = (await (
    await request.get(origin + '/api/editorial?view=bootstrap', {
      headers: { Authorization: 'Bearer ' + publisher.access_token },
    })
  ).json()) as { profile: { id: string } };
  expect(authorProfile.profile.id === publisherProfile.profile.id).toBeFalsy();
  const suffix = crypto.randomUUID(),
    filename = 'e2e-' + suffix + '.png';
  const upload = await request.post(origin + '/api/website-media', {
    headers: { Authorization: 'Bearer ' + author.access_token, Origin: origin },
    multipart: {
      file: {
        name: filename,
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGOUCDZlYGBgYmBgYGBgAAAHjQCkK1oG1QAAAABJRU5ErkJggg==',
          'base64',
        ),
      },
    },
  });
  expect(upload.ok()).toBeTruthy();
  let media = (await upload.json()) as Row;
  media = await post(request, origin, author, 'website-media', {
    id: media.id,
    version: media.version,
    target: 'Review',
    payload: {
      alt_text: 'Synthetic review test image',
      caption: 'Automated isolated staging fixture',
      shows_children: false,
      rights_confirmed: true,
      guardian_consent: false,
      consent_reference: '',
    },
  });
  const title = 'E2E programme ' + suffix;
  let record = await post<Row>(request, origin, author, 'editorial', {
    action: 'save',
    payload: {
      kind: 'programme',
      slug: 'e2e-' + suffix,
      title,
      summary: 'Synthetic staging fixture',
      body: 'Test content only',
      details: {},
      cover_id: media.id,
    },
  });
  const context = await browser.newContext({ baseURL: origin });
  await context.addInitScript(
    (value) => sessionStorage.setItem('ahf-website-session', JSON.stringify(value)),
    author,
  );
  const publisherContext = await browser.newContext({ baseURL: origin });
  await publisherContext.addInitScript(
    (value) => sessionStorage.setItem('ahf-website-session', JSON.stringify(value)),
    publisher,
  );
  const publisherPage = await publisherContext.newPage();
  const page = await context.newPage();
  try {
    await page.goto('/holyghost');
    await page.getByRole('button', { name: 'Programmes', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search content' }).fill(suffix);
    await page.getByRole('button', { name: title, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Content editor' }),
      submit = dialog.getByRole('button', { name: 'Submit for review', exact: true });
    await expect(submit).toBeDisabled();
    await expect(dialog.getByText(/Before submitting, open Media & consent/)).toBeVisible();
    await dialog
      .getByLabel('Body (paragraphs)')
      .fill('Unsaved text survives another staff member approving the image.');
    await publisherPage.goto('/holyghost');
    await publisherPage.getByRole('button', { name: 'Media & consent', exact: true }).click();
    await publisherPage.getByRole('textbox', { name: 'Search media' }).fill(filename);
    await publisherPage.locator('button.media-tile').filter({ hasText: filename }).click();
    await publisherPage
      .getByRole('button', { name: 'Approve for public use', exact: true })
      .click();
    await expect(publisherPage.getByRole('dialog', { name: 'Media review' })).toBeHidden();
    await page.bringToFront();
    await expect(dialog.getByText(/Before submitting, open Media & consent/)).toBeHidden({
      timeout: 35000,
    });
    await expect(dialog.getByLabel('Body (paragraphs)')).toHaveValue(
      'Unsaved text survives another staff member approving the image.',
    );
    await dialog.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(submit).toBeEnabled({ timeout: 35000 });
    await expect(dialog.locator('.cover-preview img')).toBeVisible();
    await submit.click();
    await expect(dialog.locator('.cms-badge').first()).toHaveText('Review');
    await expect(dialog.locator('.cover-preview img')).toBeVisible();
    const current = await request.get(origin + '/api/content-readiness?id=' + record.id, {
      headers: { Authorization: 'Bearer ' + publisher.access_token },
    });
    record = { ...record, ...((await current.json()) as { version: number }) };
    const selfApproval = await request.post(origin + '/api/editorial', {
      headers: { Authorization: 'Bearer ' + author.access_token, Origin: origin },
      data: { action: 'transition', id: record.id, version: record.version, target: 'Approved' },
    });
    expect(selfApproval.ok()).toBeFalsy();
    record = await post(request, origin, publisher, 'editorial', {
      action: 'transition',
      id: record.id,
      version: record.version,
      target: 'Approved',
    });
    record = await post(request, origin, publisher, 'editorial', {
      action: 'transition',
      id: record.id,
      version: record.version,
      target: 'Published',
    });
    await page.goto('/programmes/e2e-' + suffix);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  } finally {
    if (record.status === 'Published')
      await post(request, origin, publisher, 'editorial', {
        action: 'transition',
        id: record.id,
        version: record.version,
        target: 'Archived',
      });
    await context.close();
    await publisherContext.close();
  }
});

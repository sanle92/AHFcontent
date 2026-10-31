type Settings = Record<string, string>;
export default function DonationMethods({ settings }: { settings: Settings }) {
  const bank =
    settings.donate_bank_name &&
    settings.donate_bank_account_name &&
    settings.donate_bank_account_number;
  const mtn = settings.donate_mtn_name && settings.donate_mtn_code;
  const airtel = settings.donate_airtel_name && settings.donate_airtel_code;
  return (
    <div className="giving-methods">
      <section className="giving-card">
        <span className="giving-label">ONLINE GIVING</span>
        <h3>Give by card or mobile money</h3>
        <p>Secure online donations through DPO Pay are being prepared.</p>
        <p className="fine">
          Online checkout is not available yet. Please choose an available donation option below.
        </p>
      </section>
      {bank && (
        <section className="giving-card">
          <span className="giving-label">BANK TRANSFER</span>
          <h3>Give by bank transfer</h3>
          <dl>
            <dt>Bank</dt>
            <dd>{settings.donate_bank_name}</dd>
            <dt>Account name</dt>
            <dd>{settings.donate_bank_account_name}</dd>
            <dt>Account number</dt>
            <dd>{settings.donate_bank_account_number}</dd>
            {settings.donate_bank_branch && (
              <>
                <dt>Branch</dt>
                <dd>{settings.donate_bank_branch}</dd>
              </>
            )}
            {settings.donate_bank_swift && (
              <>
                <dt>SWIFT / BIC</dt>
                <dd>{settings.donate_bank_swift}</dd>
              </>
            )}
            {settings.donate_bank_currency && (
              <>
                <dt>Currency</dt>
                <dd>{settings.donate_bank_currency}</dd>
              </>
            )}
          </dl>
          {settings.donate_bank_instructions && <p>{settings.donate_bank_instructions}</p>}
          <p className="fine">Transfers are confirmed after the foundation verifies receipt.</p>
        </section>
      )}
      {mtn && (
        <section className="giving-card">
          <span className="giving-label">MOBILE MONEY</span>
          <h3>MTN MoMo merchant</h3>
          <dl>
            <dt>Merchant name</dt>
            <dd>{settings.donate_mtn_name}</dd>
            <dt>Merchant code</dt>
            <dd>{settings.donate_mtn_code}</dd>
          </dl>
          {settings.donate_mtn_instructions && <p>{settings.donate_mtn_instructions}</p>}
          <p className="fine">Payments are confirmed after the foundation verifies receipt.</p>
        </section>
      )}
      {airtel && (
        <section className="giving-card">
          <span className="giving-label">MOBILE MONEY</span>
          <h3>Airtel Money merchant</h3>
          <dl>
            <dt>Merchant name</dt>
            <dd>{settings.donate_airtel_name}</dd>
            <dt>Merchant code</dt>
            <dd>{settings.donate_airtel_code}</dd>
          </dl>
          {settings.donate_airtel_instructions && <p>{settings.donate_airtel_instructions}</p>}
          <p className="fine">Payments are confirmed after the foundation verifies receipt.</p>
        </section>
      )}
      {!bank && !mtn && !airtel && (
        <p>
          Bank and merchant details will appear here after they have been confirmed and approved.
        </p>
      )}
    </div>
  );
}

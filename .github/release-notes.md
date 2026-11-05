An internal shop for company merchandise, run entirely from SharePoint lists.

**To install:** download `react-company-store.sppkg` below and upload it to your SharePoint app catalog. Then add the **Company store** web part to a page, and have a site owner click **Set up the store**.

**You need:**

- **A SharePoint Administrator** to upload the package to the app catalog.
- **A site owner** to add the web part and run setup.
- **A Global Administrator** to approve the store's request to send email: SharePoint admin center → API access → Microsoft Graph · Mail.Send. Until that's approved, orders still save, but no email goes out.

The approval isn't limited to the store. It lets any SharePoint add-on in your organisation send email as the person using it, so check with IT first.

Full guide: see the [README](https://github.com/tom-daly/spfx-company-store#readme).

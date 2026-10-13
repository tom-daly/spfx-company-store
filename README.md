# Company Store

A SharePoint web part: an internal shop where staff browse company merchandise and
place orders, run entirely from SharePoint lists. No server, no payment handling —
prices are optional and most items are free.

## Setup on a new site

1. Deploy `sharepoint/solution/react-company-store.sppkg` to the app catalog.
2. Add the **Company store** web part to a page on a site all staff can open.
3. A site owner opens the page and clicks **Set up the store**. That makes four lists:

| List | Web address | Who sees what |
|---|---|---|
| Store products | `Lists/CompanyStoreProducts` | Staff read; site owners edit. |
| Store stock | `Lists/CompanyStoreStock` | Staff can change the numbers so checkout can take items off. Hidden. |
| Store orders | `Lists/CompanyStoreOrders` | One row per order. Staff see only their own; site owners see all. |
| Store addresses | `Lists/CompanyStoreAddresses` | Each person sees only their own row. Site owners are taken off it; only site collection admins can get in. Hidden, kept out of search, no version history. |

Setup is safe to run again. When something is missing or has been changed by hand,
site owners see a **Fix it** button on the page. Once the address list is locked, only
a site collection admin can change it.

Removing the web part never deletes the lists or the orders in them.

## Before going live

Each order sends one email from the buyer's own mailbox to the people in the store
settings ("Who gets order emails"), with the buyer copied in. It is the buyer's
confirmation and the store team's notice, and it stays in the buyer's Sent Items.

For that to work, IT has to approve the store's request to send email:

1. Upload the package to the app catalog (step 1 above).
2. A SharePoint admin opens the **SharePoint admin center → Advanced → API access**
   and approves the pending request **Microsoft Graph · Mail.Send**.

This needs IT's sign-off because the approval is not just for the store: it lets any
SharePoint add-on in the organisation send email as the person using it.

Until it is approved, orders still save as normal, but no email goes out and the
order shows **Email sent: No**.

## Development

Node 22. `npm install`, then:

- `npm run build` — build, lint, test and package (`sharepoint/solution/*.sppkg`).
- `npm start` — serve locally for the hosted workbench.
- `npx heft test` — run the tests.

SharePoint calls go through [PnPjs](https://pnp.github.io/pnpjs/). The list definitions
live in `src/webparts/companyStore/setup/schema.ts`.

## Licence

[MIT](LICENSE) © TMD Consulting LLC.

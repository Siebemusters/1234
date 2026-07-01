import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const fileUrl = pathToFileURL(path.resolve('crm/index.html')).href;
let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(fileUrl);
check('pagina laadt zonder JS-fouten', errors.length === 0);
if (errors.length) console.log('  errors:', errors);

// Bekende dataset -> verwachte metrics
const result = await page.evaluate(() => {
  const customers = [{ id: 'a' }, { id: 'b' }]; // 2 klanten
  const deals = [
    { customerId: 'a', value: 1000, status: 'Gewonnen' },
    { customerId: 'a', value: 500,  status: 'Verloren' },
    { customerId: 'b', value: 2000, status: 'Voorstel' },
    { customerId: 'b', value: 300,  status: 'Nieuw' },
  ];
  return window.CRM.computeMetrics(customers, deals);
});

// revenue = alleen Gewonnen = 1000
check('omzet = 1000', result.revenue === 1000);
// conversie = wonCount(1) / totalDeals(4) = 25%
check('conversie = 25%', Math.round(result.conversion) === 25);
// € per klant = 1000 / 2 = 500
check('€ per klant = 500', result.euroPerCustomer === 500);
// open = Voorstel + Nieuw = 2 deals, waarde 2300
check('open deals count = 2', result.openCount === 2);
check('open waarde = 2300', result.openValue === 2300);
// gesloten = Gewonnen + Verloren = 2
check('gesloten deals = 2', result.closedCount === 2);
// per-status waarde
check('status Voorstel waarde = 2000', result.perStatus['Voorstel'].value === 2000);
check('status Gewonnen count = 1', result.perStatus['Gewonnen'].count === 1);

// Edge case: geen data -> geen deling door nul
const empty = await page.evaluate(() => window.CRM.computeMetrics([], []));
check('leeg: conversie = 0 (geen NaN)', empty.conversion === 0);
check('leeg: € per klant = 0 (geen deling door nul)', empty.euroPerCustomer === 0);

// End-to-end: klant + deal toevoegen via de UI, metric updatet
await page.evaluate(() => localStorage.clear());
await page.goto(fileUrl);
await page.fill('#custName', 'Testklant');
await page.click('#customerForm button[type=submit]');
await page.fill('#dealValue', '1500');
await page.selectOption('#dealStatus', 'Gewonnen');
await page.click('#dealForm button[type=submit]');
const revenueText = await page.textContent('#m-revenue');
check('UI-flow: omzet toont € 1.500 na toevoegen', /1\.500/.test(revenueText));

await browser.close();
console.log(failures === 0 ? '\nALLE TESTS GESLAAGD' : `\n${failures} TEST(S) GEFAALD`);
process.exit(failures === 0 ? 0 : 1);

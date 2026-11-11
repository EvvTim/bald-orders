import { describe, expect, it } from 'vitest';
import { cellText, scrapeTable, waitForTable } from './scrape';

function makeRow(cells: string[]): string {
  return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
}

function tableHtml(rows: string[]): string {
  return `<table><tbody class="p-datatable-tbody">${rows.join('')}</tbody></table>`;
}

describe('cellText', () => {
  it('strips the mobile column-title label', () => {
    document.body.innerHTML = '<table><tr><td><span class="ui-column-title">Truck</span>TRK-42</td></tr></table>';
    const td = document.querySelector('td')!;
    expect(cellText(td)).toBe('TRK-42');
  });

  it('turns <br> into newlines and trims each line', () => {
    document.body.innerHTML = '<table><tr><td>  Acme Corp <br>  Main St 1 <br> NL Rotterdam </td></tr></table>';
    const td = document.querySelector('td')!;
    expect(cellText(td)).toBe('Acme Corp\nMain St 1\nNL Rotterdam');
  });

  it('drops blank lines', () => {
    document.body.innerHTML = '<table><tr><td>Acme<br><br>Main St 1</td></tr></table>';
    const td = document.querySelector('td')!;
    expect(cellText(td)).toBe('Acme\nMain St 1');
  });
});

describe('scrapeTable', () => {
  it('extracts one task per row with 7+ cells', () => {
    document.body.innerHTML = tableHtml([
      makeRow([
        'TRK-1',
        '#1001',
        'Steel',
        '07-03-2026 09:00',
        'Acme Corp<br>Main St 1<br>NL Rotterdam',
        '07-03-2026 18:00',
        'Beta Ltd<br>Second St 2<br>DE Berlin',
      ]),
    ]);
    const tasks = scrapeTable(document);
    expect(tasks).toEqual([
      {
        truck: 'TRK-1',
        number: '#1001',
        product: 'Steel',
        loadingDateTime: '07-03-2026 09:00',
        loadingLocation: 'Acme Corp\nMain St 1\nNL Rotterdam',
        unloadingDateTime: '07-03-2026 18:00',
        unloadingLocation: 'Beta Ltd\nSecond St 2\nDE Berlin',
      },
    ]);
  });

  it('skips rows with fewer than 7 cells', () => {
    document.body.innerHTML = tableHtml([makeRow(['a', 'b', 'c'])]);
    expect(scrapeTable(document)).toEqual([]);
  });

  it('skips placeholder rows with no truck and no number', () => {
    document.body.innerHTML = tableHtml([makeRow(['', '', 'Steel', '', '', '', ''])]);
    expect(scrapeTable(document)).toEqual([]);
  });
});

describe('waitForTable', () => {
  it('resolves with the scraped rows once the table is present', async () => {
    document.body.innerHTML = tableHtml([makeRow(['TRK-1', '#1001', 'Steel', '', '', '', ''])]);
    const tasks = await waitForTable(document, 1000, 10);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].truck).toBe('TRK-1');
  });

  it('rejects if no table ever appears', async () => {
    document.body.innerHTML = '<div>loading…</div>';
    await expect(waitForTable(document, 50, 10)).rejects.toThrow(/Tasks table not found/);
  });

  it('resolves with an empty list if the (empty) table container exists', async () => {
    document.body.innerHTML = '<div class="p-datatable-container"></div>';
    await expect(waitForTable(document, 50, 10)).resolves.toEqual([]);
  });
});

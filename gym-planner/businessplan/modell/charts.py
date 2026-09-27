"""Diagramme für den Businessplan (PNG, 200 dpi) aus zahlen.json – Palette nach dataviz-Referenz (blau, orange, aqua …)."""
from __future__ import annotations

import json
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

C = {'blue': '#2a78d6', 'orange': '#eb6834', 'aqua': '#1baf7a', 'yellow': '#eda100', 'magenta': '#e87ba4', 'green': '#008300', 'violet': '#4a3aa7', 'red': '#e34948', 'ink': '#0b0b0b', 'ink2': '#52514e', 'grid': '#e5e4e0', 'surface': '#ffffff'}
plt.rcParams.update({'font.family': 'Liberation Sans', 'font.size': 9, 'axes.edgecolor': '#c9c8c2', 'axes.linewidth': 0.6, 'axes.spines.top': False, 'axes.spines.right': False, 'axes.titleweight': 'bold', 'axes.titlesize': 10.5, 'axes.labelcolor': C['ink2'], 'xtick.color': C['ink2'], 'ytick.color': C['ink2'], 'figure.facecolor': C['surface'], 'axes.facecolor': C['surface'], 'legend.frameon': False, 'legend.fontsize': 8.5})
teur = FuncFormatter(lambda v, _: f'{v / 1000:,.0f}'.replace(',', '.') + ' T€')
tsd = FuncFormatter(lambda v, _: f'{v:,.0f}'.replace(',', '.'))


def de(v: float, dec: int = 0) -> str:
    s = f'{v:,.{dec}f}'
    return s.replace(',', 'X').replace('.', ',').replace('X', '.')


def style(ax, ylabel=''):
    ax.grid(axis='y', color=C['grid'], linewidth=0.6)
    ax.set_axisbelow(True)
    if ylabel:
        ax.set_ylabel(ylabel)


def save(fig, path):
    fig.tight_layout()
    fig.savefig(path, dpi=200)
    plt.close(fig)


def main(zpath: str, outdir: str) -> None:
    z = json.load(open(zpath, encoding='utf-8'))
    sz = z['szenarien']
    months = list(range(1, 61))
    a = z['annahmen']

    # 1 Mitgliederentwicklung
    fig, ax = plt.subplots(figsize=(7.2, 3.4))
    for key, col, lab in (('optimistisch', C['aqua'], 'optimistisch'), ('basis', C['blue'], 'Basis'), ('pessimistisch', C['orange'], 'pessimistisch')):
        ys = [sz[key]['mitglieder_monat'][str(m)] for m in months]
        ax.plot(months, ys, color=col, linewidth=2, label=lab)
        ax.annotate(f'{de(ys[-1])}', (60, ys[-1]), textcoords='offset points', xytext=(4, -3), color=C['ink2'], fontsize=8)
    ax.axhline(a['mitglieder']['kapazitaet_max_mitglieder'], color=C['ink2'], linewidth=0.8, linestyle='--')
    ax.text(1, a['mitglieder']['kapazitaet_max_mitglieder'] + 30, f"Obergrenze {de(a['mitglieder']['kapazitaet_max_mitglieder'])} Mitglieder", color=C['ink2'], fontsize=8)
    for m in (12, 24, 36, 48):
        ax.axvline(m, color=C['grid'], linewidth=0.6)
    ax.set_xlabel('Monat nach Eröffnung'); ax.set_xlim(1, 60); ax.set_ylim(0, a['mitglieder']['kapazitaet_max_mitglieder'] * 1.15)
    ax.yaxis.set_major_formatter(tsd); style(ax, 'Mitglieder (Bestand)'); ax.set_title('Mitgliederentwicklung in drei Szenarien (60 Monate)')
    ax.legend(loc='lower right', ncol=3)
    save(fig, f'{outdir}/chart_mitglieder.png')

    # 2 Umsatz, Betriebskosten, Kapitaldienst je Monat (Basis)
    b = sz['basis']
    fig, ax = plt.subplots(figsize=(7.2, 3.4))
    um = [b['umsatz_monat'][str(m)] for m in months]
    ko = [b['kosten_monat'][str(m)] for m in months]
    kd = [b['kosten_monat'][str(m)] + b['kapitaldienst_monat'][str(m)] for m in months]
    ax.plot(months, um, color=C['blue'], linewidth=2, label='Umsatz (netto)')
    ax.plot(months, ko, color=C['orange'], linewidth=2, label='Betriebskosten')
    ax.plot(months, kd, color=C['ink2'], linewidth=1.4, linestyle='--', label='Betriebskosten + Kapitaldienst')
    if b['be_monat_ebitda']:
        ax.axvline(b['be_monat_ebitda'], color=C['aqua'], linewidth=1); ax.text(b['be_monat_ebitda'] + 0.5, max(kd) * 1.02, f"Betriebs-Break-even Monat {b['be_monat_ebitda']}", color=C['aqua'], fontsize=8)
    if b['be_monat_cf']:
        ax.axvline(b['be_monat_cf'], color=C['violet'], linewidth=1); ax.text(b['be_monat_cf'] + 0.5, max(kd) * 0.92, f"Cashflow-Break-even Monat {b['be_monat_cf']}", color=C['violet'], fontsize=8)
    ax.set_xlim(1, 60); ax.set_xlabel('Monat nach Eröffnung'); ax.yaxis.set_major_formatter(teur); style(ax, 'je Monat'); ax.set_title('Umsatz gegen Kosten je Monat (Basis-Szenario)')
    ax.legend(loc='lower right'); save(fig, f'{outdir}/chart_umsatz_kosten.png')

    # 3 Liquidität
    fig, ax = plt.subplots(figsize=(7.2, 3.4))
    mon_all = [int(k) for k in b['kasse_monat'].keys()]
    xs = list(range(len(mon_all)))
    for key, col, lab in (('basis', C['blue'], 'Basis'), ('pessimistisch', C['orange'], 'pessimistisch'), ('optimistisch', C['aqua'], 'optimistisch')):
        ys = [sz[key]['kasse_monat'][str(m)] for m in mon_all]
        ax.plot(xs, ys, color=col, linewidth=2, label=lab)
    ax.axhline(0, color=C['red'], linewidth=0.8)
    ax.set_xticks([i for i, m in enumerate(mon_all) if m in (-5, 1, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60)])
    ax.set_xticklabels([str(m) for m in mon_all if m in (-5, 1, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60)])
    ax.set_xlabel('Monat (−5 bis −1 = Ausbau/Vorverkauf, 1 = Eröffnung)'); ax.yaxis.set_major_formatter(teur); style(ax, 'Kassenbestand Monatsende')
    ax.set_title(f"Liquidität mit Anlaufreserve {de(z['reserve'])} € (24 Monate Deckung)"); ax.legend(loc='upper right', ncol=3)
    save(fig, f'{outdir}/chart_liquiditaet.png')

    # 4 Mittelverwendung / Mittelherkunft
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    g = z['investition_gruppen']
    verwendung = [('Geräte und Import', g.get('geraete', 0) + g.get('import', 0), C['blue']), ('Ausbau und Sanitär', g.get('ausbau', 0) + g.get('sanitaer', 0), C['orange']), ('Planung, Sonstiges, Unvorhergesehenes', g.get('planung', 0) + g.get('sonstiges', 0) + g.get('unvorhergesehen', 0), C['aqua']), ('Kaution und Gründung', g.get('kaution', 0) + g.get('gruendung', 0), C['yellow']), ('Anlaufreserve 24 Monate', z['reserve'], C['magenta'])]
    herkunft = [('Eigenkapital (Bareinlage)', z['finanzierung']['eigenkapital'], C['blue'])]
    cols = [C['orange'], C['aqua'], C['yellow'], C['magenta'], C['violet']]
    for i, d in enumerate(z['finanzierung']['darlehen']):
        herkunft.append((d['name'].split(' (')[0].split(' –')[0], d['betrag'], cols[i % len(cols)]))
    for x, items in ((0, verwendung), (1, herkunft)):
        bottom = 0
        for lab, val, col in items:
            ax.bar(x, val, bottom=bottom, color=col, width=0.55, edgecolor='white', linewidth=1.5)
            if val >= 180000:
                ax.text(x, bottom + val / 2, f'{lab}\n{de(val / 1000)} T€', ha='center', va='center', fontsize=7.6, color='white' if col not in (C['yellow'], C['magenta'], C['aqua']) else C['ink'])
            else:
                ax.annotate(f'{lab}: {de(val / 1000)} T€', (x + 0.29, bottom + val / 2), xytext=(x + 0.36, bottom + val / 2), fontsize=7.4, color=C['ink2'], va='center', arrowprops={'arrowstyle': '-', 'color': C['ink2'], 'lw': 0.6})
            bottom += val
        ax.text(x, bottom + 30000, f'{de(bottom / 1000)} T€', ha='center', fontsize=9, fontweight='bold', color=C['ink'])
    ax.set_xticks([0, 1]); ax.set_xticklabels(['Mittelverwendung (Kapitalbedarf)', 'Mittelherkunft (Finanzierung)']); ax.set_xlim(-0.4, 1.9); ax.yaxis.set_major_formatter(teur); style(ax)
    ax.set_ylim(0, z['kapitalbedarf'] * 1.12); ax.set_title('Kapitalbedarf und Finanzierung')
    save(fig, f'{outdir}/chart_finanzierung.png')

    # 5 GuV 5 Jahre
    fig, ax = plt.subplots(figsize=(7.2, 3.4))
    years = [1, 2, 3, 4, 5]
    w = 0.26
    for i, (key, col, lab) in enumerate((('umsatz', C['blue'], 'Umsatz'), ('ebitda', C['aqua'], 'EBITDA'), ('jahresergebnis', C['orange'], 'Jahresergebnis'))):
        vals = [b['guv'][str(j)][key] for j in years]
        bars = ax.bar([j + (i - 1) * w for j in years], vals, width=w, color=col, label=lab, edgecolor='white', linewidth=1)
        for bar, v in zip(bars, vals):
            ax.text(bar.get_x() + bar.get_width() / 2, v + (12000 if v >= 0 else -30000), f'{de(v / 1000)}', ha='center', fontsize=7, color=C['ink2'])
    ax.axhline(0, color=C['ink2'], linewidth=0.8)
    for j in years:
        dscr = b['guv'][str(j)]['dscr']
        ax.text(j, ax.get_ylim()[0] * 0.98 if False else -430000, f"DSCR {str(dscr).replace('.', ',')}" if dscr is not None and j >= 2 else '', ha='center', fontsize=7.5, color=C['violet'])
    ax.set_xticks(years); ax.set_xticklabels([f'Jahr {j}' for j in years]); ax.yaxis.set_major_formatter(teur); style(ax, 'T€ (netto)')
    ax.set_title('Rentabilitätsvorschau Jahr 1–5 (Basis) mit Kapitaldienstfähigkeit'); ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.12), ncol=3); ax.set_ylim(-900000, 1650000)
    save(fig, f'{outdir}/chart_guv.png')

    # 6 Kostenstruktur Jahr 3
    k3 = b['kosten_j3']
    groups = [('Personal', k3['personal']), ('Kaltmiete', k3['miete']), ('Betriebskosten und Energie', k3['betriebskosten'] + k3['energie']), ('Marketing', k3['marketing']), ('Wartung und Instandhaltung', k3['wartung'] + k3['instandhaltung']), ('Reinigung, Hygiene', k3['reinigung']), ('Versicherung, GEMA, Software, IT', k3['versicherungen'] + k3['gema_gvl'] + k3['studiosoftware_zutritt'] + k3['telekommunikation']), ('Steuerberatung, Zahlungsverkehr', k3['steuerberater'] + k3['payment']), ('Wareneinsatz und Sonstiges', k3['wareneinsatz'] + k3['sonstiges'])]
    groups.sort(key=lambda t: t[1])
    fig, ax = plt.subplots(figsize=(7.2, 3.4))
    ax.barh([g[0] for g in groups], [g[1] for g in groups], color=C['blue'], height=0.6)
    tot = sum(g[1] for g in groups)
    for i, (lab, v) in enumerate(groups):
        ax.text(v + tot * 0.005, i, f'{de(v / 1000)} T€ ({v / tot * 100:.0f} %)'.replace('.', ','), va='center', fontsize=8, color=C['ink2'])
    ax.xaxis.set_major_formatter(teur); ax.grid(axis='x', color=C['grid'], linewidth=0.6); ax.set_axisbelow(True); ax.set_xlim(0, max(g[1] for g in groups) * 1.3)
    ax.set_title(f'Betriebskosten Jahr 3: {de(tot / 1000)} T€ (ohne Abschreibung und Kapitaldienst)')
    save(fig, f'{outdir}/chart_kosten_j3.png')

    # 7 Investition je Gruppe
    ginv = [('Geräte (Stückliste)', g.get('geraete', 0)), ('Import-Nebenkosten', g.get('import', 0)), ('Ausbau', g.get('ausbau', 0)), ('Sanitärinstallation', g.get('sanitaer', 0)), ('Planung/Genehmigung', g.get('planung', 0)), ('Sonstiges (Zutritt, Software)', g.get('sonstiges', 0)), ('Unvorhergesehenes', g.get('unvorhergesehen', 0)), ('Mietkaution', g.get('kaution', 0)), ('Gründung/Beratung', g.get('gruendung', 0))]
    ginv.sort(key=lambda t: t[1])
    fig, ax = plt.subplots(figsize=(7.2, 3.2))
    ax.barh([x[0] for x in ginv], [x[1] for x in ginv], color=C['orange'], height=0.6)
    for i, (lab, v) in enumerate(ginv):
        ax.text(v + 8000, i, f'{de(v / 1000)} T€', va='center', fontsize=8, color=C['ink2'])
    ax.xaxis.set_major_formatter(teur); ax.grid(axis='x', color=C['grid'], linewidth=0.6); ax.set_axisbelow(True); ax.set_xlim(0, max(x[1] for x in ginv) * 1.25)
    ax.set_title(f"Investition {de(z['inv_summe'] / 1000)} T€ netto (ohne Anlaufreserve)")
    save(fig, f'{outdir}/chart_investition.png')

    # 8 Kapitaldienst über 20 Jahre
    kj = z['finanzierung']['kapitaldienst_jahre']
    fig, ax = plt.subplots(figsize=(7.2, 3.0))
    yrs = [k['jahr'] for k in kj]
    ax.bar(yrs, [k['zinsen'] for k in kj], color=C['orange'], label='Zinsen / Vergütung', width=0.7)
    ax.bar(yrs, [k['tilgung'] for k in kj], bottom=[k['zinsen'] for k in kj], color=C['blue'], label='Tilgung', width=0.7)
    ax.set_xticks(yrs); ax.yaxis.set_major_formatter(teur); style(ax, 'je Jahr'); ax.set_title('Kapitaldienst über die Laufzeit (Jahreswerte, Zins auf Restschuld)'); ax.legend(loc='upper right')
    save(fig, f'{outdir}/chart_kapitaldienst.png')
    print('charts written')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

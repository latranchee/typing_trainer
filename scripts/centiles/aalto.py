"""
Builds the study curves (`STUDY`) of src/core/centile.ts from the two Aalto typing datasets.

Each curve gives, at every whole WPM from 0 to 160, the share of the study's typists whose
average speed was below it, in ten-thousandths. A typist counts once, with their own average.

Sources (free for non-commercial use with attribution to the authors):
- Desk: "136M Keystrokes", Dhakal, Feit, Kristensson, Oulasvirta, CHI 2018.
  https://userinterfaces.aalto.fi/136Mkeystrokes/ (Keystrokes.zip). The file used is
  Keystrokes/files/metadata_participants.txt, column AVG_WPM_15 (the mean of 15 sentences),
  for typists on a full keyboard or a laptop.
- Phone: "How do People Type on Mobile Devices?", Palin, Feit, Kim, Kristensson, Oulasvirta,
  MobileHCI 2019. https://userinterfaces.aalto.fi/typing37k/ (csv_raw_and_processed.zip). The
  file used is Data_Processed/open_participants.csv, column WPM (11th), every typist.

Both archives are large; the two files can be pulled alone with HTTP range requests (the
`remotezip` package). Run: python scripts/centiles/aalto.py <metadata_participants.txt> <open_participants.csv>
"""

import bisect
import csv
import sys

TOP = 160
SCALE = 10000


def desk(path: str) -> list[float]:
    with open(path, encoding='utf-8', errors='replace') as f:
        rows = csv.DictReader(f, delimiter='\t')
        return [float(r['AVG_WPM_15']) for r in rows if r['KEYBOARD_TYPE'] in ('full', 'laptop') and r['AVG_WPM_15']]


def phone(path: str) -> list[float]:
    values = []
    with open(path, encoding='utf-8', errors='replace', newline='') as f:
        for row in csv.reader(f):
            try:
                wpm = float(row[10])
            except (IndexError, ValueError):
                continue
            if wpm > 0:
                values.append(wpm)
    return values


def curve(values: list[float]) -> list[int]:
    values = sorted(values)
    n = len(values)
    return [round(bisect.bisect_left(values, w) / n * SCALE) for w in range(TOP + 1)]


def emit(name: str, values: list[float]) -> str:
    points = curve(values)
    lines = [f'  {name}: {{', f'    typists: {len(values)},', '    below: [']
    for start in range(0, len(points), 16):
        lines.append('      ' + ', '.join(str(p) for p in points[start:start + 16]) + ',')
    lines += ['    ],', '  },']
    return '\n'.join(lines)


if __name__ == '__main__':
    desk_path, phone_path = sys.argv[1:3]
    print(emit('keys', desk(desk_path)))
    print(emit('touch', phone(phone_path)))

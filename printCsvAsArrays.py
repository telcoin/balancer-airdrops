import json
from sys import argv

lines = []
with open(argv[1]) as f:
    lines = f.readlines()

print(json.dumps([l.strip().split(',')[2] for l in lines]))
print('\n\n')
amounts = [round(float(l.strip().split(',')[3])*100) for l in lines]
print(amounts)

print('\n\n')
print(sum(amounts))
"""Source-supported arithmetic examples; no policy training is performed.

Action numbers: LeRobot action_representations.mdx, ca69a2068462a37f7cdcb74180927a2f863d2bf7.
Dataset counts: robomimic PH overview and split_train_val.py, d309eaecc18acf4152a830a895a6984b8ac71b05.
The calculations and checks below are a teaching adaptation.
"""
current=[45.0,-30.0,10.0]
absolute=[[46.0,-29.0,11.0],[47.5,-27.0,12.0],[49.0,-25.0,13.5],[50.0,-24.0,15.0]]
relative=[[a-s for a,s in zip(row,current)] for row in absolute]
previous=[current]+absolute[:-1]
delta=[[a-p for a,p in zip(row,prev)] for row,prev in zip(absolute,previous)]
decoded_relative=[[s+r for s,r in zip(current,row)] for row in relative]
decoded_delta=[]
state=current.copy()
for row in delta:
    state=[s+d for s,d in zip(state,row)]
    decoded_delta.append(state)
assert decoded_relative==absolute
assert decoded_delta==absolute
print('first joint absolute:',[row[0] for row in absolute])
print('first joint relative:',[row[0] for row in relative])
print('first joint delta:',[row[0] for row in delta])
print('both decoders recover absolute:',decoded_relative==decoded_delta==absolute)
num_demos,validation_ratio=200,0.1
num_valid=int(validation_ratio*num_demos)
print('PH split counts:',{'train':num_demos-num_valid,'valid':num_valid})

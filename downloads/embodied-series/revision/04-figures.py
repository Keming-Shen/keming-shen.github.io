# SPDX-License-Identifier: MIT
"""Reproducible numerical illustrations for the embodied-intelligence series.
The formulas are cited in the per-article JSON output. This plotting code is
new code, not code copied from a textbook. Python standard library only.
Usage: python FILE.py --asset-dir figures --data-dir data
"""
import argparse, csv, html, json, math
from pathlib import Path

BLUE="#2563a6"; RED="#c74b35"; GREEN="#287f64"; GRAY="#667085"
class SVG:
    def __init__(self,w,h,title):
        self.w=w; self.h=h; self.parts=[]
        self.parts.append('<rect width="100%" height="100%" fill="#ffffff"/>')
        self.text(w/2,32,title,22,anchor="middle",bold=True)
    def text(self,x,y,s,size=16,color="#243248",anchor="start",bold=False):
        weight="bold" if bold else "normal"
        self.parts.append(f'<text x="{x:.3f}" y="{y:.3f}" font-size="{size}" fill="{color}" text-anchor="{anchor}" font-weight="{weight}">{html.escape(str(s))}</text>')
    def line(self,x1,y1,x2,y2,color=GRAY,width=1.5,dash=""):
        d=f' stroke-dasharray="{dash}"' if dash else ""
        self.parts.append(f'<line x1="{x1:.3f}" y1="{y1:.3f}" x2="{x2:.3f}" y2="{y2:.3f}" stroke="{color}" stroke-width="{width}"{d}/>')
    def poly(self,pts,color=BLUE,width=2.5,dash=""):
        d=f' stroke-dasharray="{dash}"' if dash else ""
        p=" ".join(f"{x:.3f},{y:.3f}" for x,y in pts)
        self.parts.append(f'<polyline points="{p}" fill="none" stroke="{color}" stroke-width="{width}"{d}/>')
    def circle(self,x,y,r=4,color=BLUE):
        self.parts.append(f'<circle cx="{x:.3f}" cy="{y:.3f}" r="{r}" fill="{color}"/>')
    def arrow(self,x1,y1,x2,y2,color=BLUE,width=2.5):
        self.line(x1,y1,x2,y2,color,width)
        a=math.atan2(y2-y1,x2-x1); size=9
        pts=[(x2,y2),(x2-size*math.cos(a-.45),y2-size*math.sin(a-.45)),(x2-size*math.cos(a+.45),y2-size*math.sin(a+.45))]
        p=" ".join(f"{x:.3f},{y:.3f}" for x,y in pts)
        self.parts.append(f'<polygon points="{p}" fill="{color}"/>')
    def write(self,path):
        top=f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" role="img" font-family="Arial, sans-serif">'
        Path(path).write_text(top+"\n"+"\n".join(self.parts)+"\n</svg>\n",encoding="utf-8")

def axes(s,box,xlim,ylim,xticks,yticks,xlabel="",ylabel=""):
    x,y,w,h=box
    def xy(a,b):
        return x+(a-xlim[0])/(xlim[1]-xlim[0])*w,y+h-(b-ylim[0])/(ylim[1]-ylim[0])*h
    for a,label in xticks:
        px,py=xy(a,ylim[0]); s.line(px,y,px,y+h,"#e8ecf1",1); s.text(px,y+h+24,label,14,anchor="middle")
    for b,label in yticks:
        px,py=xy(xlim[0],b); s.line(x,py,x+w,py,"#e8ecf1",1); s.text(x-10,py+5,label,14,anchor="end")
    s.line(x,y+h,x+w,y+h,"#566277",1.4); s.line(x,y,x,y+h,"#566277",1.4)
    if xlim[0]<0<xlim[1]:
        px,_=xy(0,0); s.line(px,y,px,y+h,"#b6bec9",1.2)
    if ylim[0]<0<ylim[1]:
        _,py=xy(0,0); s.line(x,py,x+w,py,"#b6bec9",1.2)
    if xlabel:s.text(x+w/2,y+h+50,xlabel,16,anchor="middle")
    if ylabel:s.text(x,y-12,ylabel,16)
    return xy

def save_json(path,data):
    Path(path).write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
def save_csv(path,header,rows):
    with Path(path).open("w",newline="",encoding="utf-8") as f:
        writer=csv.writer(f); writer.writerow(header); writer.writerows(rows)
def args():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--asset-dir",type=Path,default=Path("figures"))
    p.add_argument("--data-dir",type=Path,default=Path("data"))
    a=p.parse_args(); a.asset_dir.mkdir(parents=True,exist_ok=True); a.data_dir.mkdir(parents=True,exist_ok=True); return a
def mv(A,x):return [sum(a*b for a,b in zip(row,x)) for row in A]
def mm(A,B):return [[sum(A[i][k]*B[k][j] for k in range(len(B))) for j in range(len(B[0]))] for i in range(len(A))]
def tr(A):return [list(col) for col in zip(*A)]
def norm(x):return math.sqrt(sum(a*a for a in x))
def frob(A):return norm([a for row in A for a in row])

def inertia(q2):
    c=math.cos(q2)
    return [[5/3+c,1/3+.5*c],[1/3+.5*c,1/3]]
def gravity(q1,q2,g=9.81):
    return [1.5*g*math.cos(q1)+.5*g*math.cos(q1+q2),.5*g*math.cos(q1+q2)]
def main():
    a=args(); rows=[]
    for deg in range(181):
        H=inertia(math.radians(deg)); determinant=H[0][0]*H[1][1]-H[0][1]**2
        assert H[0][0]>0 and determinant>0
        rows.append([deg,H[0][0],H[0][1],H[1][1],determinant])
    g0=gravity(0,0); g90=gravity(0,math.pi/2); H90=inertia(math.pi/2); dynamic=mv(H90,[0,1]); tau=[x+y for x,y in zip(g90,dynamic)]
    assert abs(g0[0]-19.62)<1e-12 and abs(g0[1]-4.905)<1e-12
    assert abs(dynamic[0]-1/3)<1e-12 and abs(dynamic[1]-1/3)<1e-12
    s=SVG(1050,720,"Two-link inertia depends on the elbow configuration")
    for k,deg in enumerate([0,90,180]):
        ox=170+k*345; oy=190; scale=65; q2=math.radians(deg)
        elbow=[ox+scale,oy]; end=[elbow[0]+scale*math.cos(q2),oy-scale*math.sin(q2)]
        s.poly([(ox,oy),elbow,end],BLUE,4)
        s.circle(ox,oy,5,GRAY); s.circle(*elbow,5,BLUE); s.circle(*end,4,BLUE)
        s.text(ox+50,235,f"theta2 = {deg} deg",17,anchor="middle")
    p=axes(s,(100,315,845,300),(0,180),(-.25,2.9),[(0,"0"),(45,"45"),(90,"90"),(135,"135"),(180,"180")],[(0,"0"),(1,"1"),(2,"2")],"Elbow angle theta2 (deg)","Inertia coefficients (kg m^2)")
    for col,color,dash,label in [(1,BLUE,"","H11"),(2,RED,"","H12"),(3,GREEN,"6 4","H22")]:
        s.poly([p(r[0],r[col]) for r in rows],color,3,dash)
        for i in [0,90,180]:s.circle(*p(rows[i][0],rows[i][col]),4,color)
    s.line(270,280,300,280,BLUE,3);s.text(308,286,"H11",17,BLUE)
    s.line(465,280,495,280,RED,3);s.text(503,286,"H12",17,RED)
    s.line(660,280,690,280,GREEN,3,"6 4");s.text(698,286,"H22",17,GREEN)
    s.text(525,695,"m1 = m2 = 1 kg; l1 = l2 = 1 m; lc1 = lc2 = 0.5 m; I1 = I2 = 1/12 kg m^2",16,anchor="middle")
    s.write(a.asset_dir/"04-inertia-coupling.svg")
    save_csv(a.data_dir/"04-inertia-data.csv",["theta2_deg","H11_kg_m2","H12_kg_m2","H22_kg_m2","det_H"],rows)
    save_json(a.data_dir/"04-numerical-results.json",{
      "source":"Asada MIT2.12 Ch7 Example7.1, PDFpp.4-8, eqs.7.1.11-7.1.14; Sec7.2.3 PDFpp.11-13, inertia matrix",
      "parameters":{"link_lengths_m":[1,1],"masses_kg":[1,1],"centroid_distances_m":[.5,.5],"centroid_inertias_kg_m2":[1/12,1/12],"g_m_s2":9.81},
      "inertia_at_elbow_deg":{str(d):inertia(math.radians(d)) for d in [0,90,180]},
      "gravity_torque":{"straight_Nm":g0,"right_angle_Nm":g90},
      "acceleration_example":{"q_rad":[0,math.pi/2],"qdot_rad_s":[0,0],"qddot_rad_s2":[0,1],"acceleration_only_torque_Nm":dynamic,"total_torque_Nm":tau},
      "positive_definiteness":{"minimum_determinant_on_1deg_grid":min(r[4] for r in rows),"all_181_checks_passed":True},"checks_passed":True})
    print("04: 181 inertia matrices are positive definite; gravity and coupling examples passed.")
if __name__=="__main__":main()

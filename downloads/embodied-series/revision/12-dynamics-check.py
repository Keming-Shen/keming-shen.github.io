"""RNEA/ABA composition based on Pinocchio v3.8.0 public API.
Official source: doc/a-features/g-dynamic.md; BSD 2-Clause.
This is a mathematical consistency check, not a constrained control rollout.
"""
import numpy as np
import pinocchio as pin
model=pin.buildSampleModelManipulator()
data=model.createData()
q=pin.neutral(model)
v=np.zeros(model.nv)
a=np.linspace(-0.2,0.2,model.nv)
tau=pin.rnea(model,data,q,v,a).copy()
recovered=pin.aba(model,data,q,v,tau).copy()
print('Pinocchio:',pin.__version__)
print('nq, nv:',model.nq,model.nv)
print('round-trip error:',float(np.linalg.norm(recovered-a)))
print('close:',bool(np.allclose(recovered,a,rtol=1e-9,atol=1e-9)))

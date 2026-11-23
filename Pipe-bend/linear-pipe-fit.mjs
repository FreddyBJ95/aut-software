// Bounded weighted least-change fitting for pipe lengths. Geometry and physical
// validation belong to the caller. Inequalities use a·lengths >= b.
const dot=(a,b)=>{let sum=0;for(let i=0;i<a.length;i++)sum+=a[i]*b[i];return sum;};
const norm=a=>Math.hypot(...a);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const failed=code=>({ok:false,code});

export function fitPipeLengths(options) {
  if(!options||!Array.isArray(options.initial))return failed('INVALID_FIT');
  const {initial}=options,n=initial.length;
  const weights=options.weights??Array(n).fill(1),lower=options.lowerBounds??Array(n).fill(0);
  const equalities=options.equalities??[],inequalities=options.inequalities??[];
  if(!n||n>200||!initial.every(finite)||!Array.isArray(weights)||weights.length!==n||
    !weights.every(w=>finite(w)&&w>=1e-12&&w<=1e12)||!Array.isArray(lower)||lower.length!==n||!lower.every(finite)||
    !Array.isArray(equalities)||!Array.isArray(inequalities)||equalities.length>400||inequalities.length>12000)return failed('INVALID_FIT');
  const rowOK=row=>row&&Array.isArray(row.a)&&row.a.length===n&&row.a.every(finite)&&finite(row.b);
  if(!equalities.every(rowOK)||!inequalities.every(rowOK))return failed('INVALID_FIT');
  const roots=weights.map(Math.sqrt),basis=[],targets=[];
  // x=(length-initial)*sqrt(weight). Orthonormal equality rows define an
  // affine subspace; all inequality projections remain in its nullspace.
  for(const row of equalities) {
    const v=Float64Array.from(row.a,(a,i)=>a/roots[i]);
    let rhs=row.b-dot(row.a,initial),size=norm(v);
    if(!finite(rhs)||!finite(size))return failed('INVALID_FIT');
    if(size===0){if(Math.abs(rhs)>1e-8)return failed('INCONSISTENT_FIT');continue;}
    for(let i=0;i<n;i++)v[i]/=size;rhs/=size;
    // Reorthogonalize to retain endpoint/clip accuracy for redundant rows.
    for(let pass=0;pass<2;pass++)for(let j=0;j<basis.length;j++) {
      const factor=dot(v,basis[j]);rhs-=factor*targets[j];
      for(let i=0;i<n;i++)v[i]-=factor*basis[j][i];
    }
    size=norm(v);
    if(size<1e-14){if(Math.abs(rhs)>1e-7)return failed('INCONSISTENT_FIT');continue;}
    for(let i=0;i<n;i++)v[i]/=size;rhs/=size;
    if(!finite(rhs))return failed('INVALID_FIT');
    basis.push(v);targets.push(rhs);
  }
  const origin=new Float64Array(n);
  for(let j=0;j<basis.length;j++)for(let i=0;i<n;i++)origin[i]+=targets[j]*basis[j][i];
  const bounds=lower.map((b,i)=>{const a=Array(n).fill(0);a[i]=1;return{a,b};});
  const rows=[];
  if(n*Math.max(1,basis.length)*(inequalities.length+n)>6e7)return failed('FIT_LIMIT');
  for(const row of [...inequalities,...bounds]) {
    const raw=Float64Array.from(row.a,(a,i)=>a/roots[i]);
    const rawSize=norm(raw);
    let rhs=row.b-dot(row.a,initial)-dot(raw,origin);
    if(!finite(rhs)||!finite(rawSize))return failed('INVALID_FIT');
    if(rawSize===0){if(rhs>1e-8)return failed('INCONSISTENT_FIT');continue;}
    const v=Float64Array.from(raw,a=>a/rawSize);rhs/=rawSize;
    for(let pass=0;pass<2;pass++)for(const q of basis){const factor=dot(v,q);for(let i=0;i<n;i++)v[i]-=factor*q[i];}
    const size=norm(v);
    if(size<1e-14){if(rhs>1e-7)return failed('INCONSISTENT_FIT');continue;}
    for(let i=0;i<n;i++)v[i]/=size;rhs/=size;
    if(!finite(rhs))return failed('INVALID_FIT');
    rows.push({a:v,b:rhs,correction:0});
  }
  const y=new Float64Array(n),budget=options.maxIterations??1200;
  if(!Number.isInteger(budget)||budget<1||budget>4000)return failed('INVALID_FIT');
  const iterationsLimit=Math.max(1,Math.min(budget,Math.floor(2.4e7/Math.max(1,n*rows.length))));
  function checked(iterations,converged,vector=y) {
    const result=initial.map((v,i)=>v+(origin[i]+vector[i])/roots[i]);if(!result.every(finite))return null;
    let maxViolation=0;
    for(const row of equalities)maxViolation=Math.max(maxViolation,Math.abs(dot(row.a,result)-row.b)/Math.max(1,norm(row.a)));
    for(const row of [...inequalities,...bounds])maxViolation=Math.max(maxViolation,(row.b-dot(row.a,result))/Math.max(1,norm(row.a)));
    return maxViolation<=1e-7?{ok:true,values:result,iterations,maxViolation,converged}:null;
  }
  function activeFit(iterations) {
    // Nearly parallel active bounds can make cyclic projection converge very
    // slowly. Try their joint boundary intersection, but return it only after
    // checking every original equality and inequality. This is a feasible
    // acceleration, not a claim that the weighted optimum has converged.
    const active=rows.filter(row=>row.correction>1e-9||row.b-dot(row.a,y)>1e-7);
    if(!active.length||active.length>n+8)return null;
    const q=[],beta=[];
    for(const row of active) {
      const v=Float64Array.from(row.a);let rhs=row.b;
      for(let pass=0;pass<2;pass++)for(let j=0;j<q.length;j++){
        const factor=dot(v,q[j]);rhs-=factor*beta[j];
        for(let i=0;i<n;i++)v[i]-=factor*q[j][i];
      }
      const size=norm(v);
      if(size<1e-14){if(Math.abs(rhs)>1e-7)return null;continue;}
      for(let i=0;i<n;i++)v[i]/=size;rhs/=size;q.push(v);beta.push(rhs);
    }
    const candidate=new Float64Array(n);
    for(let j=0;j<q.length;j++)for(let i=0;i<n;i++)candidate[i]+=beta[j]*q[j][i];
    return checked(iterations,false,candidate);
  }
  // Dykstra's scalar corrections give the weighted projection, rather than
  // choosing whichever side of the pipe happened to be visited first.
  for(let iteration=0;iteration<iterationsLimit;iteration++) {
    let movement=0;
    for(const row of rows) {
      const correction=Math.max(0,row.b-dot(row.a,y)+row.correction),delta=correction-row.correction;
      if(delta!==0){for(let i=0;i<n;i++)y[i]+=delta*row.a[i];movement=Math.max(movement,Math.abs(delta));}
      row.correction=correction;
    }
    if(movement<1e-8){const result=checked(iteration+1,true);if(result)return result;}
    if(iteration===31||iteration===127){const result=activeFit(iteration+1);if(result)return result;}
  }
  return checked(iterationsLimit,false)??activeFit(iterationsLimit)??failed('FIT_NOT_FOUND');
}

const d = new Date();
d.setHours(20, 0, 0, 0);
console.log('Original local:', d.toString());
const sliced = d.toISOString().slice(0, 16);
console.log('Sliced ISO:', sliced);
const d2 = new Date(sliced);
console.log('Parsed sliced:', d2.toString());

export type LatexPreset = {
  key: string;
  label: string;
  topic: string;
  source: string;
  preview: string;
  keywords: string;
};

const p = (
  key: string,
  label: string,
  topic: string,
  source: string,
  preview: string,
  keywords: string,
): LatexPreset => ({ key, label, topic, source, preview, keywords });

export const LATEX_PRESETS: LatexPreset[] = [
  // Arithmetic (SD)
  p("arithmetic-add", "Addition: 25 + 37", "Arithmetic", "25+37=62", "25+37=62", "addition penjumlahan tambah arithmetic sd"),
  p("arithmetic-sub", "Subtraction: 48 − 29", "Arithmetic", "48-29=19", "48−29=19", "subtraction pengurangan kurang arithmetic sd"),
  p("arithmetic-mul", "Multiplication: 12 × 8", "Arithmetic", "12\\times 8=96", "12×8=96", "multiplication perkalian kali arithmetic sd"),
  p("arithmetic-div", "Division: 96 ÷ 8", "Arithmetic", "96\\div 8=12", "96÷8=12", "division pembagian bagi arithmetic sd"),
  p("arithmetic-mixed", "Mixed operations", "Arithmetic", "4+5\\times 2=14", "4+5×2=14", "mixed operasi campuran order arithmetic"),
  p("arithmetic-expanded", "Expanded form: 345", "Arithmetic", "345=300+40+5", "345=300+40+5", "expanded place value nilai tempat sd"),
  // Fractions, decimals, percent
  p("fraction-add", "Fractions: ½ + ¼", "Fractions", "\\frac{1}{2}+\\frac{1}{4}=\\frac{3}{4}", "½+¼=¾", "fraction pecahan tambah fractions sd"),
  p("fraction-sub", "Fractions: ¾ − ¼", "Fractions", "\\frac{3}{4}-\\frac{1}{4}=\\frac{1}{2}", "¾−¼=½", "fraction pecahan kurang fractions"),
  p("fraction-mixed-num", "Mixed number: 2½", "Fractions", "2\\frac{1}{2}=\\frac{5}{2}", "2½=5/2", "mixed number pecahan campuran"),
  p("fraction-percent", "Percent: 50%", "Fractions", "\\frac{50}{100}=\\frac{1}{2}=0.5", "50%=½=0.5", "percent persen decimal desimal fractions"),
  p("fraction-compare", "Compare: ⅔ > ½", "Fractions", "\\frac{2}{3}>\\frac{1}{2}", "⅔>½", "compare membandingkan pecahan fractions"),
  p("fraction-mult", "Multiply fractions", "Fractions", "\\frac{2}{3}\\times\\frac{3}{4}=\\frac{1}{2}", "⅔×¾=½", "multiply fractions perkalian pecahan"),
  // Algebra (SMP/SMA)
  p("algebra-linear", "Linear equation", "Algebra", "\\begin{aligned}2x+3&=11\\\\2x&=8\\\\x&=4\\end{aligned}", "2x+3=11", "linear equation persamaan linear aljabar smp"),
  p("algebra-system", "System: x+y, x−y", "Algebra", "\\begin{aligned}x+y&=7\\\\x-y&=1\\end{aligned}", "x+y=7", "system sistem persamaan linear spldv algebra"),
  p("algebra-quadratic-formula", "Quadratic formula", "Algebra", "x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}", "x=[−b±√]/2a", "quadratic formula rumus abc persamaan kuadrat sma"),
  p("algebra-quadratic-factor", "Factor: x²−5x+6", "Algebra", "x^2-5x+6=(x-2)(x-3)=0", "x²−5x+6", "factor pemfaktoran quadratic kuadrat algebra"),
  p("algebra-exponent", "Exponents: aᵐ·aⁿ", "Algebra", "a^m\\cdot a^n=a^{m+n}", "aᵐ·aⁿ", "exponent eksponen pangkat algebra"),
  p("algebra-power-frac", "Power of fraction", "Algebra", "\\left(\\frac{2}{3}\\right)^2=\\frac{4}{9}", "(⅔)²=4/9", "power pangkat fraction pecahan algebra"),
  p("algebra-sqrt", "Square root: √144", "Algebra", "\\sqrt{144}=12", "√144=12", "square root akar kuadrat algebra"),
  p("algebra-inequality", "Inequality: 2x+3>11", "Algebra", "2x+3>11", "2x+3>11", "inequality pertidaksamaan algebra smp"),
  // Geometry
  p("geometry-rect", "Rectangle area", "Geometry", "L=p\\times l", "L=p×l", "rectangle persegi panjang area luas geometri sd"),
  p("geometry-triangle", "Triangle area", "Geometry", "L=\\frac{1}{2}\\times a\\times t", "L=½·a·t", "triangle segitiga area luas geometri"),
  p("geometry-circle-area", "Circle area", "Geometry", "L=\\pi r^2", "L=πr²", "circle lingkaran area luas pi geometri"),
  p("geometry-circle-perimeter", "Circumference", "Geometry", "K=2\\pi r", "K=2πr", "circumference keliling lingkaran geometri"),
  p("geometry-pythagoras", "Pythagoras", "Geometry", "c^2=a^2+b^2", "c²=a²+b²", "pythagoras teorema geometri smp"),
  p("geometry-pythagoras-root", "Hypotenuse", "Geometry", "c=\\sqrt{a^2+b^2}", "c=√(a²+b²)", "hypotenuse sisi miring pythagoras geometri"),
  p("geometry-cube", "Cube volume", "Geometry", "V=s^3", "V=s³", "cube kubus volume geometri sd"),
  p("geometry-cuboid", "Cuboid volume", "Geometry", "V=p\\times l\\times t", "V=p×l×t", "cuboid balok volume geometri"),
  p("geometry-cylinder", "Cylinder volume", "Geometry", "V=\\pi r^2 t", "V=πr²t", "cylinder tabung volume geometri"),
  // Trigonometry
  p("trig-sin30", "sin 30°", "Trigonometry", "\\sin 30^\\circ=\\frac{1}{2}", "sin30°=½", "sine sin trigonometri sma"),
  p("trig-cos60", "cos 60°", "Trigonometry", "\\cos 60^\\circ=\\frac{1}{2}", "cos60°=½", "cosine cos trigonometri"),
  p("trig-tan45", "tan 45°", "Trigonometry", "\\tan 45^\\circ=1", "tan45°=1", "tangent tan trigonometri"),
  p("trig-identity", "Identity: sin²+cos²", "Trigonometry", "\\sin^2\\theta+\\cos^2\\theta=1", "sin²+cos²=1", "identity identitas trigonometri"),
  // Calculus (SMA)
  p("calculus-limit", "Limit", "Calculus", "\\lim_{x\\to 2}(3x+1)=7", "limₓ→₂", "limit kalkulus sma"),
  p("calculus-derivative", "Derivative: x³", "Calculus", "\\frac{d}{dx}x^3=3x^2", "d/dx x³", "derivative turunan kalkulus sma"),
  p("calculus-integral", "Integral", "Calculus", "\\int_0^1 x^2\\,dx=\\left[\\frac{x^3}{3}\\right]_0^1=\\frac{1}{3}", "∫₀¹x²dx", "integral kalkulus sma"),
  p("calculus-matrix", "Matrix product", "Calculus", "\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}\\begin{pmatrix}2\\\\1\\end{pmatrix}=\\begin{pmatrix}4\\\\10\\end{pmatrix}", "[1 2][2]=[4]", "matrix matriks sma"),
  // Statistics
  p("stats-mean", "Mean formula", "Statistics", "\\bar{x}=\\frac{\\sum x}{n}", "x̄=Σx/n", "mean rata-rata statistika smp sma"),
  p("stats-mean-example", "Mean example: 7,8,9", "Statistics", "\\bar{x}=\\frac{7+8+9}{3}=8", "x̄=8", "mean example contoh rata-rata statistika"),
  // Physics formulas
  p("physics-speed", "Speed: v = s/t", "Physics", "v=\\frac{s}{t}", "v=s/t", "speed kecepatan fisika smp sma"),
  p("physics-force", "Force: F = m·a", "Physics", "F=m\\times a", "F=m·a", "force gaya newton fisika"),
  p("physics-work", "Work: W = F·s", "Physics", "W=F\\times s", "W=F·s", "work usaha fisika"),
  p("physics-kinetic", "Kinetic energy", "Physics", "E_k=\\frac{1}{2}mv^2", "Ek=½mv²", "kinetic kinetik energi fisika sma"),
  p("physics-potential", "Potential energy", "Physics", "E_p=m\\times g\\times h", "Ep=mgh", "potential potensial energi fisika"),
  p("physics-density", "Density: ρ = m/V", "Physics", "\\rho=\\frac{m}{V}", "ρ=m/V", "density massa jenis fisika"),
  p("physics-ohm", "Ohm's law", "Physics", "V=I\\times R", "V=I·R", "ohm listrik fisika smp"),
  p("physics-wave", "Wave: v = λ·f", "Physics", "v=\\lambda\\times f", "v=λ·f", "wave gelombang fisika"),
  p("physics-power", "Power: P = W/t", "Physics", "P=\\frac{W}{t}", "P=W/t", "power daya fisika"),
];

export const LATEX_DEFAULT_SOURCE = "\\frac{1}{2}+\\frac{1}{4}=\\frac{3}{4}";

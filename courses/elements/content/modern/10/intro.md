---
---
Book X is the longest book of the Elements and the hardest to read: 115 propositions about straight lines that have no common measure with a given line. Read with algebra, it is a classification of the numbers you can reach from the rationals with square roots, of the forms $\sqrt{a}$, $\sqrt[4]{a}$, $\sqrt a \pm \sqrt b$ and $\sqrt{\sqrt a \pm \sqrt b}$. Euclid has no algebra. He works with lines and rectangles, and every claim about $\sqrt{\ }$ is a claim about the side of a square of a given area.

**Tools (X.1–18).** [[10.1]] is the lemma behind the method of exhaustion, used in Book XII. [[10.2]]–[[10.4]] run Euclid's algorithm on magnitudes: if the subtraction never stops, the magnitudes are incommensurable. [[10.5]]–[[10.8]] say that commensurable means "in the ratio of a whole number to a whole number". [[10.9]], the landmark, says that two lines are commensurable in length exactly when their squares are in the ratio of two square numbers. So $\sqrt n$ is irrational whenever $n$ is not a square.

**Rational and medial (X.19–35).** One line $\rho$ is fixed as *rational* ([[10.def1.3]]). Every line whose square is a rational multiple of $\rho^2$ is also called rational, so $\sqrt2\,\rho$ is rational in Euclid's sense. Below, $\rho = 1$. The first new irrational is the *medial* line $\sqrt[4]{ab}$, the side of a rectangle of sides $\sqrt a, \sqrt b$ ([[10.21]]). [[10.27]]–[[10.35]] build the pairs of lines needed next.

**Thirteen irrational lines.** Besides the medial, Euclid finds twelve kinds, six made by addition and six by subtraction:

| by addition | by subtraction | example ($\pm$) |
|---|---|---|
| binomial [[10.36]] | apotome [[10.73]] | $\sqrt 5 \pm \sqrt 2$ |
| first bimedial [[10.37]] | first apotome of a medial [[10.74]] | $\sqrt[4]{27} \pm \sqrt[4]{3}$ |
| second bimedial [[10.38]] | second apotome of a medial [[10.75]] | $\sqrt3/\sqrt[4]{2} \pm \sqrt[4]{2}$ |
| major [[10.39]] | minor [[10.76]] | $\sqrt{\tfrac{5 + \sqrt5}{2}} \pm \sqrt{\tfrac{5 - \sqrt5}{2}}$ |
| side of a rational plus a medial area [[10.40]] | that which produces with a rational area a medial whole [[10.77]] | $\sqrt{\sqrt{12} \pm 2}$ |
| side of the sum of two medial areas [[10.41]] | that which produces with a medial area a medial whole [[10.78]] | $\sqrt{\sqrt 3 \pm \sqrt 2}$ |

Every one of the twelve is $\sqrt{\sqrt A \pm \sqrt B}$ for rationals $A, B$. Which kind it is depends on two tests on the binomial $\sqrt A + \sqrt B$ under the root: is $\sqrt{A - B}$ commensurable with $\sqrt A$, and is $\sqrt A$ or $\sqrt B$ rational in length? Those tests sort the binomials into six *orders* ([[10.def2.1]]–[[10.def2.6]]), and the apotomes likewise ([[10.def3.1]]–[[10.def3.6]]). The rest of the book proves that the classification is sound. [[10.42]]–[[10.47]] and [[10.79]]–[[10.84]] show that each line splits into its two terms in only one way. [[10.48]]–[[10.72]] and [[10.85]]–[[10.110]] construct the six orders, prove that the side of $\rho$ times a binomial of order $k$ is the $k$-th additive line and conversely, and show that a line commensurable with one of these lines is of the same kind. The same is done for the apotomes. [[10.111]] shows that a binomial is never an apotome, so the thirteen kinds are all different. [[10.112]]–[[10.114]] rationalize denominators: $1/(\sqrt a + \sqrt b)$ is an apotome with terms in the same ratio. [[10.115]] ends the book by showing that there are infinitely many further kinds.

::irrationals

**Why.** Book XIII uses the classification: the edge of the icosahedron inscribed in a sphere of rational diameter is a minor line ([[13.16]]), and the side of the regular pentagon in a circle of rational diameter is also minor ([[13.11]]). An ancient scholium credits much of the book to Theaetetus. Plato's dialogue *Theaetetus* shows him, as a young man, generalizing Theodorus' proofs that $\sqrt3, \sqrt5, \dots, \sqrt{17}$ are irrational.

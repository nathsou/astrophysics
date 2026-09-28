import { propositions } from '../text';

export default function About() {
  return (
    <div className="page about">
      <h1>About this edition</h1>

      <h2>The text</h2>
      <p>
        The text is <b>Thomas Little Heath’s translation</b>, <i>The Thirteen Books of Euclid’s Elements</i> (Cambridge University Press, 1908), which is in the public
        domain. It is reproduced word for word from the TEI encoding of the{' '}
        <a href="https://github.com/PerseusDL/canonical-greekLit/tree/master/data/tlg1799/tlg001">Perseus Digital Library</a> (Tufts University), published under{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. Heath’s notes on the translation appear under each proposition. His much longer
        commentary is not included. Scans of the printed volumes are on HathiTrust:{' '}
        <a href="https://hdl.handle.net/2027/uva.x001426155">volume 1</a>, <a href="https://hdl.handle.net/2027/uva.x001671689">volume 2</a>,{' '}
        <a href="https://hdl.handle.net/2027/uva.x001866313">volume 3</a>.
      </p>
      <p>
        A converter reads the pinned TEI file and produces the text of every definition, postulate, common notion and proposition ({propositions.length} propositions). The build fails if its output is stale. Heath marks the
        lettered objects (<i>AB</i>, <i>ABC</i>) and brackets Euclid’s justifications ([I. 4], [Post. 1]). The converter keeps both, which gives the figure links
        and the dependency graph.
      </p>

      <h2>The modern versions</h2>
      <p>
        Each item has a modern version written for this edition. It states the result in current notation, gives a faithful modern account of Euclid’s argument, and adds
        notes where they help: gaps in Euclid’s rigour and how later mathematics repaired them, a programmer’s view, and where the result leads. They are written for readers who know
        some mathematics or programming but have not done geometry since school.
      </p>

      <h2>The figures</h2>
      <p>
        Every figure is a small program. It takes the given points (which you can drag), numbers (sliders) or the view angle of a solid, and carries out the
        construction. The figure is therefore always the construction applied to the current data, never a drawing of one case. Each label in Heath’s text is matched
        to the object it names, using the word in front of it (“the angle <i>ABC</i>”, “the circle <i>BCD</i>”). Hovering either highlights the other, and stepping through a proof
        builds the figure up paragraph by paragraph.
      </p>
      <p>
        Each figure also states the proposition’s conclusion numerically; the readouts under the figure show it live. The test suite checks every figure in fifty
        random configurations. A numerical check is not a proof. It catches mistakes in the figures, and it lets you watch a theorem hold while you try to break it.
      </p>

      <h2>Byrne mode</h2>
      <p>
        In 1847 Oliver Byrne published the first six books with coloured diagrams in place of letters: a red line, a yellow triangle, a blue angle. Byrne mode does the
        same for all thirteen books. The objects the text mentions are coloured, and the letters in the text become small drawings of the objects they name. The colours
        follow Byrne’s palette. The layout is this edition’s own.
      </p>

      <h2>The workshop</h2>
      <p>
        The workshop turns Euclid’s constructions into puzzles. It starts with Postulates 1–3 only, and every construction you solve becomes a tool, just as each
        proposition becomes available to the later ones. A solution is checked by running it again on randomly moved givens, so a construction that only looks right
        in one position is caught.
      </p>

      <h2>Credits</h2>
      <p>
        Euclid, c. 300 BC. Translation and notes: T. L. Heath (1908). Encoding: Perseus Digital Library, CC BY-SA 4.0. Everything else (the modern versions,
        figures, workshop and explorations) was written for this edition.
      </p>
    </div>
  );
}

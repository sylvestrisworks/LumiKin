// Third-person credentialed editor statement (brief Phase 2). Shared by the
// methodology and partners pages so the two can't drift. Method- and
// independence-led: this is where the independence claim lives, not the warm
// /about narrative. Hardcoded English, matching the institutional/founder-page
// convention (partners + methodology are not run through the message catalog).

export default function EditorStatement() {
  return (
    <div className="max-w-2xl space-y-5 text-ink/80 leading-relaxed">
      <p>
        LumiKin is built and edited by <strong className="text-ink">Johan Sjöstedt</strong>, a
        journalist with a background in anthropology who applies sourcing discipline and systematic
        observation to a question the established rating bodies structurally cannot answer: not
        whether a game is <em>appropriate</em>, but whether it is <em>worth a child&rsquo;s time</em>{' '}
        — and which specific experiences inside today&rsquo;s platforms actually are.
      </p>
      <p>
        The methodology is grounded in peer-reviewed developmental psychology rather than personal
        opinion, and it weighs benefit against risk rather than simply flagging danger — because
        parents who value games need discernment, not just restriction.
      </p>

      {/* COLLABORATOR_SEAM: insertion point for a named academic advisor's role in the methodology, once secured */}

      <p>
        LumiKin is independent: it takes no funding from the platforms it rates or from the
        parental-control vendors it works with, and every score carries a named, accountable editor
        behind it.
      </p>
    </div>
  )
}

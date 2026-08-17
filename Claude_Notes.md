Architecture, top to bottom

Five layers, each with a distinct job:

1. Upload & schema input (UI) — form to upload a PDF + define fields to extract (e.g. policy_number: string).
2. PDF tokenization — parse the PDF into text with coordinates, not just raw text. This is the layer everything else depends on.
3. AI extraction — send the text + schema to an LLM, get back {value, rationale, quote} per field. Critically: don't ask the model for pixel coordinates. Ask it for the exact verbatim quote it based the value on.
4. Grounding (matching) — deterministic code, no AI: search the tokenized text for that quote, find which tokens it spans, compute the bounding box from their coordinates.
5. Rendering — render the PDF page (canvas/image), overlay an absolutely-positioned box scaled to the bbox from step 4.

The reason step 3 and step 4 are split is the core design decision here: LLMs are unreliable at reporting pixel coordinates, but they're reliable at quoting text verbatim from what you gave them. So you let the model do what it's good at (reading, reasoning, quoting) and let deterministic string-matching code do what it's good at (finding exact positions). This is the "AI-native" pattern worth internalizing — don't ask the model to do something a normal function can do better.

The alternative is a vision-based approach — render pages as images, ask a multimodal model to return bounding boxes directly. It's a shorter pipeline and also works on scanned PDFs, but bbox accuracy from vision models is much less trustworthy, and it teaches you less about the actual mechanics. Worth knowing about as a fallback for scanned/non-text PDFs later, but not where I'd start.

Smallest vertical slice (v0)

Everything possible stripped out except proving the mechanic works end to end:

In scope:
- One hardcoded PDF (pick a real one with selectable text, not a scan)
- One hardcoded schema field (e.g. "Policy Number")
- Server-side: tokenize → call LLM → ground the answer → return {value, rationale, page, bbox}
- Client-side: render that one page, draw one highlight box

Explicitly out of scope for v0: file upload UI (use a static test file first), multi-field schema, multi-page highlighting, auth, persistence/database, deployment, error handling for bad PDFs, scanned/OCR support.

First implementation step

Before touching Next.js, the AI call, or any UI: prove you can extract text-with-coordinates from a real PDF and that string-matching a quote back to a bounding box actually works. This is the highest-uncertainty part of the whole system — if grounding doesn't work reliably, nothing downstream matters.

Concretely:
- Use pdfjs-dist in a standalone Node script (no framework yet) against one sample PDF.
- Call its text-content API to get a flat list of {text, x, y, width, height, page} tokens.
- Pick a known string from that PDF, write a small matcher that finds it in the token stream and computes the union bounding box.
- Print the result and sanity-check it against the actual PDF (e.g. by drawing the box on an image export of the page).

Once that primitive is solid, the next steps follow in order: wire in the LLM call (schema in, {value, rationale, quote} out), then connect the two, then finally build the Next.js upload UI and canvas overlay around it.

Want to start with that tokenization script, or talk through the LLM extraction step's prompt/output shape first?




### 
 This makes sense conceptually, but please explain it to me more simply. I’m new to PDF internals and terms like tokenization, grounding, coordinates, and canvas overlays. Walk me through the same architecture as if I’m building my first version and explain what each layer does in plain English.
  Also, for the MVP I don’t want the user to have to write a technical schema like policy_number: string. I want the user to be able to say something simple like Extract Policy Number. Can we design the input that way and translate it internally into whatever structured schema the system needs?
   I'm learning some of these concepts as I build, so when you introduce a new engineering term or abstraction, briefly explain what it means and why we need it before using it. Don't oversimplify the engineering — I want to learn the proper terminology — but don't assume I already know unfamiliar concepts.
### 
The architecture, in plain English

First, one fact about PDFs that the whole design depends on: most PDFs (not scanned photos of paper, but "real" digital PDFs) don't just contain a picture of text — they contain the actual text characters, each one placed at a specific spot on the page, like sticky notes glued down at exact positions. That's what makes this whole project possible: you're not reading a picture, you're reading real text that already knows where it sits on the page.

Here's the same five layers, in plain terms:

1. Upload & tell the app what you want
You upload a PDF and say what you want out of it. This is the only layer the user directly interacts with at the start.

2. Read the PDF's text and remember where everything sits on the page
A PDF page is basically a grid — like graph paper. Every bit of text has a position on that grid, usually measured in small units called points, counted from a corner of the page. That position (an x number for left-right, a y number for up-down, plus a width and height) is called a bounding box — literally the box that bounds (surrounds) one piece of text.

To get all of this out of the PDF, we use a library that reads the PDF's internal structure and hands us back a big list: "the word 'Policy' is at this position, the word 'Number' is at this position," and so on, for every piece of text on every page. Breaking the document down into that list of small pieces is often called tokenization — each piece (a "token") is not just a word, but a word plus its exact position and size. Think of it as taking the PDF apart into hundreds of labeled sticky notes.

This is the foundation layer — nothing after this works without it.

3. Ask the AI to find the answer
We hand the AI model the text (not the positions — just the words) plus what the user wants, and ask it to figure out the value. But instead of just asking for the answer, we also ask it for two more things: a plain-English explanation of why it picked that value (the rationale), and the exact phrase from the document it based its answer on (a verbatim quote).

Here's the important design choice: we deliberately do not ask the AI to tell us the pixel position of the answer. AI models are good at reading and reasoning, but bad at knowing exact coordinates — they'll guess and often be wrong. So we only ask it for what it's actually good at: finding the right text and explaining itself.

4. Double-check the AI's answer and locate it on the page
This is called grounding — connecting the AI's answer back to a real, verifiable spot in the actual source document, instead of just trusting it. Why do we need this? Because an AI can paraphrase, slightly reword, or (rarely) make things up. So we take the exact quote it gave us back in step 3, and search for that exact text in our sticky-note list from step 2. When we find where it appears, we already know its bounding box — because that's information we collected ourselves in step 2, not something the AI told us. This step is plain code, not AI — a search-and-match operation, deterministic and checkable.

5. Show the PDF with a highlight box drawn on top
In the browser, we draw the PDF page as an image using something called a canvas — think of it as a blank drawing surface the browser gives you, like an empty piece of paper you can draw shapes and images onto with code. We draw the PDF page onto it, and then draw a colored rectangle on top at the bounding box position from step 4. That colored rectangle drawn on top of the page is what's meant by an overlay — literally one layer laid over another, positioned by numbers rather than glued to the content underneath.

Plain-English schema input — yes, and here's how

You're right that policy_number: string is unnecessary technical detail to ask a user for. The fix is: add a small translation step, and let the AI do the translating.

Concretely — before step 3 (the extraction call), add a new small AI call: the user types something like "Extract Policy Number" (or later, "get me the policy number and the effective date"), and we ask the AI to convert that free-text sentence into a structured list our code can work with, e.g. [{ name: "policy_number", description: "The insurance policy number" }].

Quick definition since it matters here: structured output means forcing the AI's response into a fixed, predictable shape (like a specific JSON format you define) instead of free-flowing prose. Code can reliably read field.name; code can't reliably read "the policy number, I think it's usually near the top." Modern AI APIs let you specify a required output shape and the model conforms to it — that's what makes step 3 possible at all (we need {value, rationale, quote} back in a predictable shape, not a paragraph).

So the design becomes: plain English → (AI translation call) → structured schema → (AI extraction call) → value + rationale + quote → (grounding) → bounding box → (rendering) → highlighted PDF. Two separate AI calls, each doing one narrow job well — which is itself a pattern worth noticing: small, single-purpose AI calls chained together tend to be more reliable than one AI call trying to do everything at once.

For the v0 vertical slice, my instinct is to still hardcode the schema first (skip the translation call initially) so you're only debugging one new thing at a time — get extraction + grounding + rendering solid, then add the plain-English translation layer on top once the core loop works. But if you'd rather build the translation call first since it's simpler than the grounding logic, that's a reasonable alternative order too. Which do you want to tackle first?


###

 but what if pdf is scanned? or first version should be simple?

Good instinct to ask — this is exactly the kind of thing that decides scope, not just a technicality.

What "scanned" means here: a scanned PDF is essentially a photograph of a paper page, saved inside a PDF wrapper. There are no real text characters in it at all — just pixels, like a JPEG. That breaks layer 2 completely: when we ask the PDF for its text-with-positions list, we get back nothing, because there's no text to find. It's not that our reading gets less accurate — it fails outright.

How you'd normally handle it: a technology called OCR (Optical Character Recognition) — software that looks at the image pixels and recognizes what letters and words are drawn there, essentially "reading" a picture the way a human would. Good OCR tools don't just return text — they return the text and its bounding box on the page, same shape of output as our layer 2 gives us for real PDFs. That's a useful detail: OCR isn't a small patch on top of the current design, it's a second, separate way to produce layer 2's output (text + coordinates). Layers 3, 4, and 5 wouldn't care which one produced the data, as long as the shape matches — same {text, x, y, width, height, page} list either way.

Recommendation: keep v0 simple, skip scanned PDFs entirely for now. Pick a real digital-text PDF to test with (open it and try selecting/highlighting text with your cursor — if you can select individual words, it's got a text layer and will work; if the whole page selects as one image, it's scanned). Don't even build detection logic for scanned files yet — just don't test with one. OCR is a legitimate second phase later: new dependency, new accuracy questions, and it's cleanly separable from everything you're building now, so there's no cost to deferring it.

✻ Cogitated for 17s

❯ also what if the text is not easily deduced

This is the real risk in the whole design — worth slowing down on.

Where this breaks: in step 4 (grounding), we search for the AI's exact quote inside our list of text-with-positions. That search can fail to find a clean match for a few different reasons:

- The AI slightly reworded it — e.g. it quotes "January 15, 2024" but the document actually says "01/15/2024" and the model reformatted the date instead of copying it. Even a small change breaks an exact text search.
- Whitespace or line breaks differ — the document might have the value split across two lines (e.g. a long name wraps), while the AI reads it as one continuous phrase. Our token list has each piece separately, so gluing them back into one search string requires decisions about spacing that might not match.
- The PDF's internal reading order is jumbled — this is a subtler one. A PDF doesn't have to store text in the order you'd read it visually. In documents with columns or tables, the internal order of text pieces can jump around (e.g. read down a column, then the next column, in a way that doesn't match a normal left-to-right reading). If our token list is out of order, a phrase that looks contiguous on the page might not be contiguous in our data.

How to handle it, from simplest to most robust:

1. Exact match, normalized first. Before searching, strip out formatting noise on both sides — collapse multiple spaces into one, trim line breaks, ignore case. This alone fixes most near-misses without any fancy logic.
2. Instruct the AI to copy, not paraphrase. A cheap fix at the source: explicitly tell the model in the prompt "copy the value character-for-character exactly as it appears in the source — do not reformat dates, numbers, or punctuation." This reduces how often step 3 even produces a quote that doesn't literally exist in the text.
3. Fuzzy matching, as a fallback. If exact match (even normalized) still fails, you can fall back to fuzzy matching — a technique that finds the closest matching text rather than requiring a perfect match, using something like edit distance (how many single-character changes would turn one string into the other). This is more forgiving but also more complex and occasionally wrong, so it's a second-tier solution, not the default.
4. Honest failure, not a wrong guess. If nothing matches even approximately, the right behavior is to still show the value and rationale, but say "location not found in document" instead of drawing a highlight box in the wrong place. A visibly wrong highlight is worse than no highlight — it silently damages trust in the tool.

For v0, I'd keep it simple: exact match with basic whitespace normalization, plus the prompt instruction to copy verbatim, plus the graceful "couldn't locate" fallback. Skip fuzzy matching and reading-order fixes for now — they're real problems, but they show up on messier documents, and you want to first confirm the whole pipeline works cleanly on a well-behaved PDF before hardening it against edge cases.

One related scoping note: this whole approach assumes the value is literally present as text in the document (an "extractive" field, like a policy number). If someone asks for something computed or summarized (e.g. "total of all line items"), there's no single quote to ground — that's a different, harder problem, worth explicitly ruling out of scope for now rather than discovering as a surprise later.

✻ Baked for 31s

❯ meaning - there is no exact Policy Number:XXX. but it needs to be deduced

Good clarification — there are actually two different situations hiding under "deduced," and they have very different implications:

Case A: no label, but the value is still there as text — the AI just has to figure out which piece of text is the right one. Example: the document never writes "Policy Number: XXX", but somewhere on the page it says "This certifies that policy no. 4471928-A is in effect..." — the number is there in plain text, just not in a tidy label: value format. The AI has to read the surrounding sentence to recognize that this number, specifically, is the policy number (as opposed to a claim number, a phone number, or a date, which might also appear on the page as digits).

This case is actually already handled by the design you have. Nothing changes: step 3 (AI extraction) does exactly this kind of reasoning already — that's the whole reason we ask for a rationale, not just a value. The model reads context, decides "this number, because of the surrounding words, is the policy number," and reports it. Step 4 (grounding) still works fine, because whatever number the model lands on is still sitting verbatim in the document text — we just search for that exact string like normal. Deduction is about which text is correct, not about the text existing or not. So this case doesn't need any new engineering — it's a prompting/reasoning quality question, not an architecture question.

Case B: the value doesn't exist anywhere as one contiguous piece of text at all. Example: the policy number is actually built from a prefix printed in a header box ("4471928") and a suffix printed separately in a table ("A"), and a human would combine them mentally into "4471928-A" — but that exact combined string never appears anywhere on the page. Or the value requires arithmetic (e.g. "total premium" = sum of three line items shown separately). Here, there is no single quote to search for, so step 4's whole approach (search for the exact string) has nothing to find.

This second case is the genuinely hard one, and it's the one I'd keep out of scope for v0 — not because it's rare, but because it needs a different mechanism (e.g. returning multiple source locations for one field instead of one bounding box, or explicitly labeling a field as "derived" rather than "found"). That's a real, worthwhile v2 feature, just not a v0 one.

So — which of these were you picturing? If it's Case A (unlabeled but present), you don't need to change anything about the plan. If it's Case B (genuinely scattered or computed values), that's worth explicitly writing down as a known future limitation now, so it doesn't surprise you later.

✻ Sautéed for 25s

❯ but what if there is a paragraph of insurance text and it says if this coverage covers smth. and if the user asks for smth based on that para

This case is actually good news — it stretches the design, but it doesn't break it. Let me show you why.

Example: the schema field is something like "Does this policy cover water damage?", and the document has a paragraph like "Coverage under this policy extends to water damage except where caused by flooding, unless a flood rider endorsement has been purchased."

Why the existing pipeline still works: the output shape we defined back in step 3 was {value, rationale, quote}. Nothing about that shape assumes the value is a short field like a policy number. It works exactly the same way here:
- value: "Yes, with exclusions for flood-caused water damage"
- rationale: the AI's plain-English explanation of how it reached that conclusion
- quote: the exact sentence(s) from the paragraph it based that conclusion on, copied verbatim

The only real difference from the policy-number case is that the quote is now a whole sentence or two instead of a short phrase, and the value is a conclusion the AI reasoned its way to, rather than a value it simply copied. Step 4 (grounding) doesn't care — it does the same thing either way: search for the quote in our text-with-positions list, and box whatever tokens it spans. It just so happens the box ends up bigger — a highlighted paragraph instead of a small rectangle around a number. Same mechanism, bigger result.

Where it does get genuinely harder: if the true answer requires combining two paragraphs that aren't next to each other — say, the general coverage clause is on page 2, but an exclusion that changes the answer is buried in page 9. Then there's no single contiguous quote to point to; the honest answer is "based on these two separate excerpts." That's a small, natural extension of the data shape (a list of quotes instead of one quote, producing a list of highlight boxes instead of one) rather than a new mechanism — grounding still just searches for each quote independently and boxes each one. It's a real feature to add later, but it's a much smaller lift than the scanned-PDF or computed-value problems, because you're just changing "one of these" to "a list of these," not inventing a new pipeline.

Worth naming explicitly: this kind of field is quietly shifting the product from "extract labeled fields" toward "answer questions about the document" — which is a legitimate and common use case (this is basically document Q&A), but it's a different mental model for what "schema" means. I'd keep v0 scoped to the single-paragraph, single-quote case (one coherent answer, one supporting excerpt) and treat "answer requires multiple scattered excerpts" as the first real extension once the core loop is working — it's a natural next step, not a redesign.
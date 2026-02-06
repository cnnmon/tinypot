import Header from '@/components/Header';

export default function HelpPage() {
  return (
    <div className="min-h-screen p-4 gap-2 flex flex-col items-center bg-gradient-to-b from-[#EBF7D2] via-[#B7DCBD] to-white">
      <div className="w-full max-w-2xl flex flex-col items-start gap-6 pb-12">
        <Header />

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">How it Works</h1>
          <p className="text-neutral-600">
            Bonsai is a tool for creating interactive fiction through a mix of manual authoring and AI-assisted
            generation.
          </p>
        </div>

        {/* Process */}
        <section className="flex flex-col gap-4 w-full">
          <h2 className="text-lg font-semibold border-b pb-1">The Process</h2>

          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--mint)] flex items-center justify-center text-sm font-medium">
                1
              </span>
              <div>
                <p className="font-medium">Author your story</p>
                <p className="text-sm text-neutral-600">
                  Write directly in the script editor using markup, or playtest and click on any text to edit it
                  permanently.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--mint)] flex items-center justify-center text-sm font-medium">
                2
              </span>
              <div>
                <p className="font-medium">Play to explore</p>
                <p className="text-sm text-neutral-600">
                  Navigate your story as a player. Your input will match defined choices, or the AI will generate new
                  branches. Other players can explore too!
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--mint)] flex items-center justify-center text-sm font-medium">
                3
              </span>
              <div>
                <p className="font-medium">Prune your branches</p>
                <p className="text-sm text-neutral-600">
                  Review AI-generated changes, edit them, then approve or discard. Only the latest unresolved branch can
                  be discarded, so work through them in order.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--mint)] flex items-center justify-center text-sm font-medium">
                4
              </span>
              <div>
                <p className="font-medium">Check the guidebook</p>
                <p className="text-sm text-neutral-600">
                  The guidebook automatically learns your preferences from edits. Check it occasionally to ensure
                  it&apos;s on track, or edit it directly.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Syntax Reference */}
        <section className="flex flex-col gap-4 w-full">
          <h2 className="text-lg font-semibold border-b pb-1">Syntax Reference</h2>

          {/* Scenes */}
          <div>
            <h3 className="font-medium">Scenes</h3>
            <p className="text-sm text-neutral-600 mb-2">
              Scenes are marked with <code>@</code>. They define locations or states in your story.
              Add <code>[allows: new|link|text]</code> to control AI generation.
            </p>
            <pre className="bg-white/60 p-3 rounded text-sm font-mono border">
              {`@HOME
You're in a cozy room.

@GARDEN [allows: new]
The flowers sway gently.
(AI can create new scenes from here)

@HUB [allows: text]
What do you want to do?
(AI can only add flavor text, no scene changes)`}
            </pre>
            <p className="text-sm text-neutral-500 mt-2">
              <code>new</code> = AI can create scenes (default), <code>link</code> = only existing scenes, <code>text</code> = flavor only
            </p>
          </div>

          {/* Choices */}
          <div>
            <h3 className="font-medium">Choices</h3>
            <p className="text-sm text-neutral-600 mb-2">
              Use <code>if</code> to define player choices. Separate synonyms with <code>|</code>.
            </p>
            <pre className="bg-white/60 p-3 rounded text-sm font-mono border">
              {`if go outside | leave | exit
    You step out into the garden.
    goto @GARDEN`}
            </pre>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-medium">Navigation</h3>
            <p className="text-sm text-neutral-600 mb-2">
              <code>goto @SCENE</code> moves the player to another scene.
            </p>
            <pre className="bg-white/60 p-3 rounded text-sm font-mono border">
              {`if open the door
    The door creaks open.
    goto @HALLWAY`}
            </pre>
          </div>

          {/* Variable Effects */}
          <div>
            <h3 className="font-medium">Variables (Counters)</h3>
            <p className="text-sm text-neutral-600 mb-2">
              Variables are <strong>counters</strong>. Use <code>+var</code> to increment (add 1), <code>-var</code> to
              decrement (subtract 1). Use <code>& ?var</code> after a choice to require it.
            </p>
            <pre className="bg-white/60 p-3 rounded text-sm font-mono border">
              {`if buy sword
    -gold
    +sword
    You got a sword!

if buy another sword
    -gold
    +sword
    Now you have two swords!

if attack & ?sword
    You swing your blade.`}
            </pre>
            <p className="text-sm text-neutral-500 mt-2">
              Display: <code>sword</code> (count=1), <code>sword (2)</code> (count=2), etc.
            </p>
          </div>

          {/* Conditions */}
          <div>
            <h3 className="font-medium">Conditional Blocks</h3>
            <p className="text-sm text-neutral-600 mb-2">
              Use <code>when var</code> (true if ≥1), <code>when !var</code> (true if 0), or{' '}
              <code>when var {'>'}= N</code> for threshold checks.
            </p>
            <pre className="bg-white/60 p-3 rounded text-sm font-mono border">
              {`@SHOP
when gold >= 10
    You can afford the sword!
when !gold
    Your pockets are empty.

@BATTLE
when sword >= 2
    You dual-wield your blades!
when sword
    You swing your sword.
when !sword
    You fight with your fists.`}
            </pre>
          </div>

          {/* Turn Counter & Global Preamble */}
          <div>
            <h3 className="font-medium">Turn Counter & Global Conditions</h3>
            <p className="text-sm text-neutral-600 mb-2">
              A <code>turn</code> variable auto-increments on each player input. Add <strong>global conditions</strong>{' '}
              before any scene to create time limits or pacing.
            </p>
            <pre className="bg-white/60 p-3 rounded text-sm font-mono border">
              {`when turn >= 10
    Time is running out...
when turn >= 20
    goto @GAME_OVER

@START
You begin your adventure.
if explore
    goto @FOREST

@GAME_OVER
Your time has run out.
goto @END`}
            </pre>
          </div>

          {/* Images */}
          <div>
            <h3 className="font-medium">Images</h3>
            <p className="text-sm text-neutral-600 mb-2">
              Add images with <code>[image: url]</code>.
            </p>
            <pre className="bg-white/60 p-3 rounded text-sm font-mono border">
              {`@GARDEN
[image: https://example.com/garden.png]
The garden is beautiful.`}
            </pre>
          </div>

          {/* Indentation */}
          <div>
            <h3 className="font-medium">Indentation</h3>
            <p className="text-sm text-neutral-600 mb-2">
              Use tabs to nest content under choices and conditions. Everything indented under an <code>if</code> or{' '}
              <code>when</code> belongs to that block.
            </p>
            <pre className="bg-white/60 p-3 rounded text-sm font-mono border">
              {`when !key
    Oh lookee, there's a key!
    if take it | yes
        +key
        Yoink!
    if leave it | no
        You step back.`}
            </pre>
          </div>
        </section>

        {/* Tips */}
        <section className="flex flex-col gap-3 w-full">
          <h2 className="text-lg font-semibold border-b pb-1">Tips</h2>
          <ul className="list-disc list-inside text-sm text-neutral-600 space-y-1">
            <li>
              Use <code>@END</code> as a special scene to end the story.
            </li>
            <li>Synonyms in choices make your game more forgiving to players.</li>
            <li>Generated branches appear in the branch panel — review and prune regularly.</li>
            <li>The guidebook learns from your edits to generated content, making future generations better.</li>
            <li>
              Use <code>when turn {'>'}= N</code> in the global preamble for time limits or pacing events.
            </li>
            <li>
              Stack variables with multiple <code>+var</code> for inventory, XP, or resource systems.
            </li>
            <li>
              Use <code>[allows: text]</code> on hub scenes to force explicit branches, letting AI extend within paths.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

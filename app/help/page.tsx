import Header from '@/components/Header';

export default function HelpPage() {
  return (
    <div className="h-screen p-4 gap-2 flex flex-col">
      <Header />
      <div className="max-w-2xl mx-auto p-8 space-y-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Script Syntax</h2>
          <p className="text-neutral-600">
            Write interactive stories using a simple plaintext format.
          </p>

          <div className="bg-neutral-50 p-4 font-mono text-sm space-y-1 border">
            <p>@SCENE_NAME</p>
            <p className="text-neutral-400"># Declare a new scene</p>
            <br />
            <p>Regular text is narrative.</p>
            <br />
            <p>if Choice text | alias1 | alias2</p>
            <p className="pl-4">Response when chosen.</p>
            <p className="pl-4">goto @NEXT_SCENE</p>
            <br />
            <p>[sets: variable]</p>
            <p className="text-neutral-400"># Set a variable</p>
            <br />
            <p>if Conditional choice & [variable]</p>
            <p className="text-neutral-400"># Only shows if variable is set</p>
            <br />
            <p>if Another choice & [!variable]</p>
            <p className="text-neutral-400"># Only shows if variable is NOT set</p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Indentation with Stars</h2>
          <p className="text-neutral-600">
            Use <code className="bg-neutral-100 px-1">*</code> to indicate nesting levels instead of
            spaces. Each star equals one level of indentation (like Ink).
          </p>

          <div className="bg-neutral-50 p-4 font-mono text-sm space-y-1 border">
            <p>if take the key</p>
            <p>* Yoink!</p>
            <p>* goto @HOME</p>
            <br />
            <p className="text-neutral-400"># Multiple stars for deeper nesting:</p>
            <p>if [!key]</p>
            <p>* Take the key?</p>
            <p>* if take it | yes</p>
            <p>** You grab the key.</p>
            <p>** [sets: key]</p>
          </div>

          <p className="text-neutral-600 text-sm">
            <code className="bg-neutral-100 px-1">*</code> = 1 level,{' '}
            <code className="bg-neutral-100 px-1">**</code> = 2 levels,{' '}
            <code className="bg-neutral-100 px-1">***</code> = 3 levels, etc.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Automatic Conditionals</h2>
          <p className="text-neutral-600">
            Show different content automatically based on player state. These run without waiting
            for player input.
          </p>

          <div className="bg-neutral-50 p-4 font-mono text-sm space-y-1 border">
            <p>if [key]</p>
            <p>* You use the key to unlock the door.</p>
            <p>* [unsets: key]</p>
            <p>[else]</p>
            <p>* The door is locked. You need a key.</p>
          </div>

          <p className="text-neutral-600 text-sm">
            Use <code className="bg-neutral-100 px-1">if [variable]</code> to check if set,{' '}
            <code className="bg-neutral-100 px-1">if [!variable]</code> to check if not set. Add{' '}
            <code className="bg-neutral-100 px-1">[else]</code> for alternative content.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Nested Options in Conditionals</h2>
          <p className="text-neutral-600">
            Put choices inside conditionals to show different options based on player state. All
            available options are shown together.
          </p>

          <div className="bg-neutral-50 p-4 font-mono text-sm space-y-1 border">
            <p>@DESK</p>
            <p>if [!key]</p>
            <p>* There&apos;s a key on the desk. Take it?</p>
            <p>* if take the key | yes</p>
            <p>** Yoink!</p>
            <p>** [sets: key]</p>
            <p>* if leave it | no</p>
            <p>** You leave the key.</p>
            <p>if [key]</p>
            <p>* The desk is empty now.</p>
            <p>if leave | go back</p>
            <p>* goto @HOME</p>
          </div>

          <p className="text-neutral-600 text-sm">
            In this example, &quot;leave&quot; is always available. The key-related options only
            appear when the key hasn&apos;t been taken yet.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Images</h2>
          <p className="text-neutral-600">Add images to your scenes.</p>

          <div className="bg-neutral-50 p-4 font-mono text-sm border">
            <p>[image: https://example.com/scene.png]</p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Branches</h2>
          <p className="text-neutral-600">
            When players type something that doesn&apos;t match an existing choice, AI generates a
            new branch. These appear in the Branches panel.
          </p>

          <ul className="list-disc pl-5 text-neutral-600 space-y-1">
            <li>
              <strong>Resolve</strong> — merge the generated content into your script
            </li>
            <li>
              <strong>Revert changes</strong> — discard the branch and revert changes
            </li>
            <li>
              <strong>Edit</strong> — modify the generated content before accepting
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Guidebook</h2>
          <p className="text-neutral-600">
            The guidebook teaches the AI about your game&apos;s world, tone, and rules. Write notes
            like:
          </p>

          <div className="bg-neutral-50 p-4 text-sm border italic text-neutral-700">
            &quot;This is a cozy mystery set in a small town. The player is a detective. Keep
            responses short and atmospheric.&quot;
          </div>

          <p className="text-neutral-600">
            The guidebook <strong>learns automatically</strong> from your branch edits. When you
            modify generated content before accepting, the AI learns your preferences.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Player Controls</h2>
          <ul className="list-disc pl-5 text-neutral-600 space-y-1">
            <li>
              <strong>← (undo)</strong> — go back to before your last choice
            </li>
            <li>
              <strong>↻ (restart)</strong> — restart from the beginning
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Quick Reference</h2>
          <table className="w-full text-sm border">
            <thead className="bg-neutral-50">
              <tr>
                <th className="text-left p-2 border-b">Syntax</th>
                <th className="text-left p-2 border-b">Purpose</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr>
                <td className="p-2 border-b">@SCENE</td>
                <td className="p-2 border-b font-sans">Scene label</td>
              </tr>
              <tr>
                <td className="p-2 border-b">goto @SCENE</td>
                <td className="p-2 border-b font-sans">Jump to scene</td>
              </tr>
              <tr>
                <td className="p-2 border-b">goto @END</td>
                <td className="p-2 border-b font-sans">End the game</td>
              </tr>
              <tr>
                <td className="p-2 border-b">if Choice | alias</td>
                <td className="p-2 border-b font-sans">Player choice with aliases</td>
              </tr>
              <tr>
                <td className="p-2 border-b">& [var]</td>
                <td className="p-2 border-b font-sans">Require variable</td>
              </tr>
              <tr>
                <td className="p-2 border-b">& [!var]</td>
                <td className="p-2 border-b font-sans">Require variable NOT set</td>
              </tr>
              <tr>
                <td className="p-2 border-b">[sets: var]</td>
                <td className="p-2 border-b font-sans">Set a variable</td>
              </tr>
              <tr>
                <td className="p-2 border-b">[unsets: var]</td>
                <td className="p-2 border-b font-sans">Unset a variable</td>
              </tr>
              <tr>
                <td className="p-2 border-b">if [var]...[else]</td>
                <td className="p-2 border-b font-sans">Auto-conditional block</td>
              </tr>
              <tr>
                <td className="p-2 border-b">[image: url]</td>
                <td className="p-2 border-b font-sans">Display image</td>
              </tr>
              <tr>
                <td className="p-2 border-b">* / ** / ***</td>
                <td className="p-2 border-b font-sans">Indentation (1/2/3 levels)</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

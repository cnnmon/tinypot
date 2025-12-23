about bonsai:

authors start by writing as much of the game as they'd like in the editor, as little as just a few lines, a decision point, and a few (optional) options. the decision point will prompt the player for input.

in the player, whenever the player types whatever they'd like to do, and the story branches accordingly: either defaulting to a similar enough existing option ("run away" is akin to "sneak out"), linking to an existing branch, or generating a new branch permanently and navigating you there in real-time in the game.

the editor reflects changes in real-time, and authors can use version control to view auto-commits and prune unwanted branches. authors can also set prompts (either scene-based or globally) to guide narrative direction and constraints. authors and players are collaborating on this game intermediated by ai, which bridges the player’s contribution into the author’s stylistic world to generate new sections.

these features provide built-in caching, making the game increasingly fast for playing as it expands and covers possibility space, only generating for new, unseen choices. this also prevents authoring overwhelm, as updates are staggered based on when a player has actually tried an option given the scene's context, which may realistically change as parts of the game are refactored and edited.

how can we learn preferences? after author prunes branches, generate a style guide prompt by analyzing kept vs pruned. use llm to meta-reason: analyze these kept and pruned branches. what patterns distinguish them? generate a style guide. prepend this generated style to future generation prompts

the authoring language:

uses a pseudomarkdown language for interactive narrative authoring.

```
Can you believe it?
> FIRE
# FIRE
The fire burns brightly.
~ Ride a bike
   That's cool!
   > BIKE
~ Run away
   Weirdo…
# BIKE
Learn to sail
> END
```

this should read:
Can you believe it?
The fire burns brightly.
[Waits for input]
[USER INPUT: "Run away"]
Weirdo...
[Waits for input]
[USER INPUT: "Ride a bike"]
That's cool!
Learn to sail
[END]

each scene is denoted by a (#) and will loop its option (~) selection until you go to (>) another scene or END.

versioning:
each playthrough should be capable of creating a new BRANCH. the playthrough should be reactive to edits in the editor, but any already committed lines to history should not be changed -- only future lines/options if you're currently perusing them.

future work:
want this to be a place where you can prune branches but don't want games to be limited to this interface. i want to expose it as an api so anyone can use it in their projects with their own LLM API keys. this would also benefit my future web games.

import type {
  ShowcaseCommentFixture,
  ShowcasePostFixture
} from "./showcase.types.js";

const comment = (
  key: string,
  postKey: string,
  authorKey: ShowcaseCommentFixture["authorKey"],
  milestonePosition: number,
  body: string,
  reactionUserKeys: ShowcaseCommentFixture["reactionUserKeys"]
): ShowcaseCommentFixture => ({
  key,
  postKey,
  authorKey,
  milestonePosition,
  body,
  hoursAfterPost: 5,
  reactionUserKeys
});

const reply = (
  key: string,
  postKey: string,
  parentKey: string,
  authorKey: ShowcaseCommentFixture["authorKey"],
  milestonePosition: number,
  body: string,
  reactionUserKeys: ShowcaseCommentFixture["reactionUserKeys"]
): ShowcaseCommentFixture => ({
  ...comment(
    key,
    postKey,
    authorKey,
    milestonePosition,
    body,
    reactionUserKeys
  ),
  parentKey,
  hoursAfterPost: 10
});

export const showcasePosts: ShowcasePostFixture[] = [
  {
    key: "hp_letters",
    clubKey: "harryPotter",
    authorKey: "nadia",
    type: "QUESTION",
    title: "Which Hogwarts letter detail first made the world feel real?",
    body: "The letters arriving through every possible opening is funny, but it also shows how completely the magical world can overwhelm the ordinary one. Which detail sold that transition for you?",
    milestonePosition: 1,
    daysAgo: 13,
    reactionUserKeys: ["maya", "priya"]
  },
  {
    key: "hp_chamber",
    clubKey: "harryPotter",
    authorKey: "nadia",
    type: "DISCUSSION",
    title: "The diary works better once you know what it really is",
    body: "On a reread, Tom Riddle's diary feels less like a convenient mystery device and more like an early warning about how memory and identity can be stored and manipulated.",
    milestonePosition: 2,
    daysAgo: 11,
    reactionUserKeys: ["maya", "liam"]
  },
  {
    key: "hp_patronus",
    clubKey: "harryPotter",
    authorKey: "priya",
    type: "PREDICTION",
    title: "Could Harry's Patronus be pointing toward a family connection?",
    body: "The shape feels too deliberate to be only a powerful spell effect. I think it connects Harry's happiest memory to something he still does not fully understand about his parents.",
    milestonePosition: 3,
    predictionRevealPosition: 4,
    daysAgo: 9,
    reactionUserKeys: ["maya", "elena"]
  },
  {
    key: "hp_graveyard",
    clubKey: "harryPotter",
    authorKey: "owen",
    type: "REACTION",
    title: "The graveyard changes the entire series",
    body: "Cedric's death is so abrupt that the tournament adventure disappears instantly. Voldemort's return makes every earlier warning feel real and leaves Harry carrying a truth the adults do not want to hear.",
    milestonePosition: 4,
    daysAgo: 7,
    reactionUserKeys: ["maya", "liam"]
  },
  {
    key: "hp_tower",
    clubKey: "harryPotter",
    authorKey: "liam",
    type: "THEORY",
    title: "Dumbledore's final request sounds planned",
    body: "The Astronomy Tower scene reads differently when you focus on Dumbledore speaking to Snape rather than only on Harry's shock. Their earlier conversations suggest the outcome may have been arranged.",
    milestonePosition: 6,
    daysAgo: 4,
    reactionUserKeys: ["maya", "elena"]
  },
  {
    key: "hp_final",
    clubKey: "harryPotter",
    authorKey: "maya",
    type: "REVIEW",
    title: "The Battle of Hogwarts rewards the whole journey",
    body: "Neville facing the snake, the defenders returning, and Harry choosing to walk into the forest all pay off qualities established years earlier. Which payoff felt most earned?",
    milestonePosition: 7,
    daysAgo: 2,
    reactionUserKeys: ["elena"]
  },

  {
    key: "got_ned",
    clubKey: "gameOfThrones",
    authorKey: "nadia",
    type: "REACTION",
    title: "Ned's execution rewrites the rules of the show",
    body: "The scene removes the character who seemed built to anchor the story. From that moment, political consequences feel more important than narrative protection.",
    milestonePosition: 1,
    daysAgo: 14,
    reactionUserKeys: ["maya", "theo"]
  },
  {
    key: "got_blackwater",
    clubKey: "gameOfThrones",
    authorKey: "nadia",
    type: "DISCUSSION",
    title: "Blackwater makes Tyrion the clearest leader in the city",
    body: "The wildfire plan is spectacular, but the real turning point is Tyrion convincing frightened people to keep defending a city that rarely respects him.",
    milestonePosition: 2,
    daysAgo: 12,
    reactionUserKeys: ["maya", "owen"]
  },
  {
    key: "got_red_wedding",
    clubKey: "gameOfThrones",
    authorKey: "jordan",
    type: "JUST_REACHED",
    title: "I just reached the Red Wedding and need a minute",
    body: "The music, the closed doors, and Catelyn noticing the armor turn a celebration into dread before the violence begins. The scene feels inevitable only after it is already too late.",
    milestonePosition: 3,
    daysAgo: 10,
    reactionUserKeys: ["theo", "liam"]
  },
  {
    key: "got_hardhome",
    clubKey: "gameOfThrones",
    authorKey: "maya",
    type: "DISCUSSION",
    title: "Hardhome finally makes the larger war undeniable",
    body: "The political conflicts suddenly look tiny beside the dead rising in silence. Jon understands the threat, but almost nobody with power has witnessed what he has.",
    milestonePosition: 5,
    daysAgo: 6,
    reactionUserKeys: ["theo", "elena"]
  },
  {
    key: "got_hodor",
    clubKey: "gameOfThrones",
    authorKey: "liam",
    type: "THEORY",
    title: "Hodor's story makes Bran's power much more frightening",
    body: "The revelation links past and present in a way that causes permanent harm. If Bran can affect one life so deeply, what other events may already include his influence?",
    milestonePosition: 6,
    daysAgo: 4,
    reactionUserKeys: ["theo", "elena"]
  },
  {
    key: "got_final",
    clubKey: "gameOfThrones",
    authorKey: "theo",
    type: "REVIEW",
    title: "What did the final ruler choice mean to you?",
    body: "Bran becoming king shifts the ending away from conquest and toward memory, but the limited preparation makes the decision divisive. Did the idea work even if the execution did not?",
    milestonePosition: 8,
    daysAgo: 1,
    reactionUserKeys: ["elena"]
  },

  {
    key: "sw_podrace",
    clubKey: "starWars",
    authorKey: "priya",
    type: "QUESTION",
    title: "Does the podrace earn its long runtime?",
    body: "It establishes Anakin's instincts, mechanical skill, and dangerous confidence without needing a speech about any of them. Which part of the sequence matters most later?",
    milestonePosition: 1,
    daysAgo: 13,
    reactionUserKeys: ["maya", "elena"]
  },
  {
    key: "sw_order66",
    clubKey: "starWars",
    authorKey: "maya",
    type: "REACTION",
    title: "Order 66 turns the whole trilogy into tragedy",
    body: "The rapid fall of the Jedi makes Palpatine's planning feel enormous. Anakin entering the temple is the point where fear has fully replaced every reason he wanted power.",
    milestonePosition: 3,
    daysAgo: 10,
    reactionUserKeys: ["liam", "elena"]
  },
  {
    key: "sw_trench",
    clubKey: "starWars",
    authorKey: "maya",
    type: "DISCUSSION",
    title: "The trench run is a perfect first-film climax",
    body: "Han returns, Luke trusts the Force, and the impossible target pays off every skill introduced earlier. It is simple, clear, and still tense after countless rewatches.",
    milestonePosition: 4,
    daysAgo: 8,
    reactionUserKeys: ["liam", "elena"]
  },
  {
    key: "sw_cloud",
    clubKey: "starWars",
    authorKey: "owen",
    type: "JUST_REACHED",
    title: "The Cloud City reveal changes every earlier conversation",
    body: "Vader's revelation is famous, but Luke's refusal to accept it is what makes the scene land. The victory belongs to Vader because he destroys Luke's certainty, not because he wins the duel.",
    milestonePosition: 5,
    daysAgo: 6,
    reactionUserKeys: ["liam", "elena"]
  },
  {
    key: "sw_endor",
    clubKey: "starWars",
    authorKey: "owen",
    type: "THEORY",
    title: "Luke wins by refusing the Emperor's definition of strength",
    body: "Throwing away the weapon looks like surrender, but it is the choice that gives Vader one final chance to return as Anakin. The throne room is won through restraint.",
    milestonePosition: 6,
    daysAgo: 4,
    reactionUserKeys: ["liam", "elena"]
  },
  {
    key: "sw_exegol",
    clubKey: "starWars",
    authorKey: "elena",
    type: "REVIEW",
    title: "Did Exegol close the Skywalker Saga effectively?",
    body: "The fleet arrival delivers scale and Rey's final choice reinforces found family, but Palpatine's return competes with the consequences of the previous films. What would you preserve?",
    milestonePosition: 9,
    daysAgo: 2,
    reactionUserKeys: ["liam"]
  },

  {
    key: "lotr_rivendell",
    clubKey: "lordOfTheRings",
    authorKey: "nadia",
    type: "QUESTION",
    title: "When did Strider fully earn the hobbits' trust?",
    body: "He begins as a frightening stranger in Bree, but his choices on the road to Rivendell steadily reveal patience and responsibility. Was there one decisive moment?",
    milestonePosition: 2,
    daysAgo: 13,
    reactionUserKeys: ["maya", "liam"]
  },
  {
    key: "lotr_moria",
    clubKey: "lordOfTheRings",
    authorKey: "maya",
    type: "REACTION",
    title: "Moria turns ancient history into immediate danger",
    body: "The abandoned halls, Balin's tomb, and the drums make the past feel present before the Balrog appears. Gandalf's fall then forces the Fellowship to continue without its guide.",
    milestonePosition: 4,
    daysAgo: 10,
    reactionUserKeys: ["theo", "liam"]
  },
  {
    key: "lotr_boromir",
    clubKey: "lordOfTheRings",
    authorKey: "theo",
    type: "DISCUSSION",
    title: "Boromir's final stand completes his character",
    body: "His attempt to take the Ring matters, but so does the immediate recognition of what he has done. Protecting Merry and Pippin becomes a final act of courage rather than a simple erasure of failure.",
    milestonePosition: 5,
    daysAgo: 8,
    reactionUserKeys: ["liam", "elena"]
  },
  {
    key: "lotr_helms",
    clubKey: "lordOfTheRings",
    authorKey: "liam",
    type: "DISCUSSION",
    title: "Helm's Deep balances despair and momentum perfectly",
    body: "The long wait makes every loss feel costly, while the arrival at dawn works because hope has nearly disappeared. The parallel march of the Ents gives the victory a wider meaning.",
    milestonePosition: 6,
    daysAgo: 6,
    reactionUserKeys: ["theo", "elena"]
  },
  {
    key: "lotr_shelob",
    clubKey: "lordOfTheRings",
    authorKey: "elena",
    type: "PREDICTION",
    title: "Sam carrying the Ring may be the real final test",
    body: "Sam now has both the burden and the power to continue alone. His loyalty is clear, but the Ring has a way of turning even good intentions into possession.",
    milestonePosition: 7,
    predictionRevealPosition: 9,
    daysAgo: 4,
    reactionUserKeys: ["liam", "theo"]
  },
  {
    key: "lotr_mountdoom",
    clubKey: "lordOfTheRings",
    authorKey: "liam",
    type: "REVIEW",
    title: "The Ring is destroyed through mercy, not perfect willpower",
    body: "Frodo cannot surrender the Ring at the final moment, yet Bilbo and Frodo sparing Gollum makes its destruction possible. The ending treats compassion as part of the victory.",
    milestonePosition: 9,
    daysAgo: 1,
    reactionUserKeys: ["theo", "elena"]
  }
];

export const showcaseComments: ShowcaseCommentFixture[] = [
  comment(
    "hp_letters_c1",
    "hp_letters",
    "theo",
    1,
    "The cupboard address changing each time is my favorite detail. It is playful and slightly unsettling at once.",
    ["maya"]
  ),
  reply(
    "hp_letters_r1",
    "hp_letters",
    "hp_letters_c1",
    "nadia",
    1,
    "Yes, and the flood of letters makes the Dursleys' resistance look completely hopeless.",
    ["priya"]
  ),
  comment(
    "hp_chamber_c1",
    "hp_chamber",
    "priya",
    2,
    "The diary also makes Harry trust a version of events simply because he experiences it directly.",
    ["maya"]
  ),
  comment(
    "hp_patronus_c1",
    "hp_patronus",
    "maya",
    3,
    "The lake scene makes that connection feel intentional, especially once Harry understands who actually cast the Patronus.",
    ["elena"]
  ),
  reply(
    "hp_patronus_r1",
    "hp_patronus",
    "hp_patronus_c1",
    "theo",
    4,
    "The next book adds even more weight to inherited symbols and chosen identity.",
    ["maya"]
  ),
  comment(
    "hp_graveyard_c1",
    "hp_graveyard",
    "liam",
    4,
    "The return to Hogwarts is almost as painful because the crowd initially thinks the tournament has ended normally.",
    ["maya"]
  ),
  comment(
    "hp_tower_c1",
    "hp_tower",
    "elena",
    6,
    "Snape's hesitation and Dumbledore's tone both support the idea that the scene follows an earlier agreement.",
    ["maya"]
  ),
  comment(
    "hp_final_c1",
    "hp_final",
    "elena",
    7,
    "Neville destroying the snake is my favorite payoff because courage was his defining challenge from the first book.",
    ["maya"]
  ),

  comment(
    "got_ned_c1",
    "got_ned",
    "maya",
    1,
    "Arya witnessing it from the crowd makes the political event intensely personal and shapes everything she becomes.",
    ["theo"]
  ),
  comment(
    "got_blackwater_c1",
    "got_blackwater",
    "owen",
    2,
    "The chain and wildfire show his preparation, but the speech proves he can lead people under pressure.",
    ["maya"]
  ),
  comment(
    "got_red_c1",
    "got_red_wedding",
    "liam",
    3,
    "Catelyn recognizing the song is the instant when every earlier breach of trust arrives at once.",
    ["theo"]
  ),
  comment(
    "got_hardhome_c1",
    "got_hardhome",
    "theo",
    5,
    "The Night King raising the dead without a speech is the strongest possible answer to every skeptic.",
    ["maya"]
  ),
  comment(
    "got_hodor_c1",
    "got_hodor",
    "theo",
    6,
    "It also turns a familiar character detail into evidence of a tragedy that has been present since episode one.",
    ["elena"]
  ),
  reply(
    "got_hodor_r1",
    "got_hodor",
    "got_hodor_c1",
    "liam",
    6,
    "That circular cause is what makes Bran's gift feel more like a responsibility than an advantage.",
    ["theo"]
  ),
  comment(
    "got_final_c1",
    "got_final",
    "elena",
    8,
    "The theme makes sense to me, but I wanted more scenes showing why the other leaders would accept that solution.",
    ["theo"]
  ),

  comment(
    "sw_podrace_c1",
    "sw_podrace",
    "maya",
    1,
    "The repair sequence beforehand matters because the race then feels like a test of skills we have already seen.",
    ["elena"]
  ),
  comment(
    "sw_order66_c1",
    "sw_order66",
    "liam",
    3,
    "The cross-cutting makes the fall feel galactic while keeping Anakin's choice at the emotional center.",
    ["elena"]
  ),
  comment(
    "sw_trench_c1",
    "sw_trench",
    "elena",
    4,
    "Han's return works because it resolves his internal conflict without distracting from Luke's decisive action.",
    ["liam"]
  ),
  comment(
    "sw_cloud_c1",
    "sw_cloud",
    "liam",
    5,
    "The missing hand and impossible choice leave Luke physically and emotionally defeated at the same time.",
    ["elena"]
  ),
  comment(
    "sw_endor_c1",
    "sw_endor",
    "elena",
    6,
    "Luke's faith is not that Vader is secretly harmless; it is that he can still make one different choice.",
    ["liam"]
  ),
  comment(
    "sw_exegol_c1",
    "sw_exegol",
    "liam",
    9,
    "I would keep the citizen fleet and Rey choosing her own name, but build the antagonist through the trilogy much earlier.",
    ["elena"]
  ),

  comment(
    "lotr_rivendell_c1",
    "lotr_rivendell",
    "maya",
    2,
    "For me it is Weathertop: he stays calm, protects them, and understands exactly what Frodo's wound means.",
    ["liam"]
  ),
  comment(
    "lotr_moria_c1",
    "lotr_moria",
    "theo",
    4,
    "The quiet grief in Lothlórien afterward prevents the escape from feeling like an immediate reset.",
    ["liam"]
  ),
  comment(
    "lotr_boromir_c1",
    "lotr_boromir",
    "liam",
    5,
    "Aragorn's response matters too: he gives Boromir dignity without pretending the Ring never affected him.",
    ["elena"]
  ),
  comment(
    "lotr_helms_c1",
    "lotr_helms",
    "theo",
    6,
    "The civilians waiting in the caves keep the battle tied to ordinary people rather than only heroic spectacle.",
    ["elena"]
  ),
  comment(
    "lotr_shelob_c1",
    "lotr_shelob",
    "liam",
    7,
    "Sam's temptation is not conquest but the dream that he could use power to repair everything himself.",
    ["theo"]
  ),
  reply(
    "lotr_shelob_r1",
    "lotr_shelob",
    "lotr_shelob_c1",
    "elena",
    9,
    "That is why giving it back later feels like a genuine moral victory rather than a simple handoff.",
    ["liam"]
  ),
  comment(
    "lotr_mountdoom_c1",
    "lotr_mountdoom",
    "theo",
    9,
    "It is a remarkable refusal to make the hero's worth depend on being stronger than the Ring forever.",
    ["elena"]
  )
];

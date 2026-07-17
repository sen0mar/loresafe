import type { ShowcaseClubFixture } from "./showcase.types.js";

export const showcaseClubs: ShowcaseClubFixture[] = [
  {
    key: "harryPotter",
    title: "Hogwarts Reading Circle",
    linkName: "hogwarts-reading-circle",
    description:
      "A book-by-book Harry Potter reread where every discussion unlocks at the right year.",
    category: "BOOKS",
    visibility: "PUBLIC",
    rules:
      "Set your current book before reading. Keep titles spoiler-safe, attach every post to the right year, and never hint at later identities or deaths.",
    milestones: [
      {
        position: 1,
        safeTitle: "Year One checkpoint",
        fullTitle: "The Stone, the Mirror of Erised, and Quirrell",
        description:
          "Harry reaches Hogwarts, faces the trials beneath the trapdoor, and learns who was seeking the Stone.",
        spoilerName: true
      },
      {
        position: 2,
        safeTitle: "Year Two checkpoint",
        fullTitle: "The Chamber of Secrets and the basilisk",
        description:
          "The diary, the hidden chamber, and the identity behind the attacks are now open for discussion.",
        spoilerName: true
      },
      {
        position: 3,
        safeTitle: "Year Three checkpoint",
        fullTitle: "Sirius Black, the Time-Turner, and the Patronus",
        description:
          "The truth about Sirius, Pettigrew, and the night by the lake can be discussed here.",
        spoilerName: true
      },
      {
        position: 4,
        safeTitle: "Year Four checkpoint",
        fullTitle: "Cedric's death and Voldemort's return",
        description:
          "The Triwizard Tournament, the graveyard, and the Dark Lord's return are unlocked.",
        spoilerName: true
      },
      {
        position: 5,
        safeTitle: "Year Five checkpoint",
        fullTitle: "Dumbledore's Army and the Ministry battle",
        description:
          "The resistance at Hogwarts, the prophecy, and the battle in the Department of Mysteries are open.",
        spoilerName: true
      },
      {
        position: 6,
        safeTitle: "Year Six checkpoint",
        fullTitle: "The Horcrux lesson and Dumbledore's death",
        description:
          "The Half-Blood Prince, the cave, and the Astronomy Tower can be discussed freely.",
        spoilerName: true
      },
      {
        position: 7,
        safeTitle: "Final year checkpoint",
        fullTitle: "The Hallows, the Horcrux hunt, and the Battle of Hogwarts",
        description:
          "The complete ending, including Snape's memories and the final confrontation, is unlocked.",
        spoilerName: true
      }
    ]
  },
  {
    key: "gameOfThrones",
    title: "The Realm Remembers",
    linkName: "the-realm-remembers",
    description:
      "A season-by-season Game of Thrones discussion club built for first watches and rewatches.",
    category: "TV_SHOWS",
    visibility: "PUBLIC",
    rules:
      "Use the earliest season required by your point. Do not disguise future spoilers as theories, reaction GIF descriptions, or character nicknames.",
    milestones: [
      {
        position: 1,
        safeTitle: "Season One complete",
        fullTitle: "Ned Stark's execution and Daenerys's dragons",
        description:
          "The fall of Ned Stark and the birth of the dragons are available for discussion.",
        spoilerName: true
      },
      {
        position: 2,
        safeTitle: "Season Two complete",
        fullTitle: "The Battle of Blackwater",
        description:
          "Tyrion's defense of King's Landing and the wildfire attack are unlocked.",
        spoilerName: true
      },
      {
        position: 3,
        safeTitle: "Season Three complete",
        fullTitle: "The Red Wedding",
        description:
          "The events at the Twins and their consequences can be discussed openly.",
        spoilerName: true
      },
      {
        position: 4,
        safeTitle: "Season Four complete",
        fullTitle: "The Purple Wedding, the trial, and Oberyn's duel",
        description:
          "Joffrey's wedding, Tyrion's trial, and the Mountain versus the Viper are unlocked.",
        spoilerName: true
      },
      {
        position: 5,
        safeTitle: "Season Five complete",
        fullTitle: "Hardhome and Cersei's walk",
        description:
          "The Night King's attack at Hardhome and the upheaval in King's Landing are open.",
        spoilerName: true
      },
      {
        position: 6,
        safeTitle: "Season Six complete",
        fullTitle: "Hold the Door and the Battle of the Bastards",
        description:
          "Hodor's origin, the battle for Winterfell, and Cersei's wildfire plan are unlocked.",
        spoilerName: true
      },
      {
        position: 7,
        safeTitle: "Season Seven complete",
        fullTitle: "The frozen lake and the Wall's fall",
        description:
          "The expedition beyond the Wall and the Night King's new weapon can be discussed.",
        spoilerName: true
      },
      {
        position: 8,
        safeTitle: "Final season complete",
        fullTitle: "The Long Night, King's Landing, and the final ruler",
        description:
          "The complete ending and the final fates of the major characters are unlocked.",
        spoilerName: true
      }
    ]
  },
  {
    key: "starWars",
    title: "Galactic Saga Archive",
    linkName: "galactic-saga-archive",
    description:
      "A private chronological journey through the nine films of the Skywalker Saga.",
    category: "MOVIES",
    visibility: "PRIVATE",
    rules:
      "Membership is approved privately. Mark every theory and reveal at the earliest episode it requires, including identity and family connections.",
    milestones: [
      {
        position: 1,
        safeTitle: "Episode I complete",
        fullTitle: "The podrace, Darth Maul, and the Naboo victory",
        description:
          "Anakin's discovery, the duel on Naboo, and the beginning of the saga are unlocked.",
        spoilerName: false
      },
      {
        position: 2,
        safeTitle: "Episode II complete",
        fullTitle: "The clone army and the Battle of Geonosis",
        description:
          "The mystery on Kamino and the outbreak of the Clone Wars are open for discussion.",
        spoilerName: true
      },
      {
        position: 3,
        safeTitle: "Episode III complete",
        fullTitle: "Order 66 and Anakin's fall",
        description:
          "Palpatine's victory, the Jedi purge, and the birth of Darth Vader are unlocked.",
        spoilerName: true
      },
      {
        position: 4,
        safeTitle: "Episode IV complete",
        fullTitle: "The Death Star trench run",
        description:
          "Leia's rescue, Obi-Wan's sacrifice, and the destruction of the Death Star are open.",
        spoilerName: false
      },
      {
        position: 5,
        safeTitle: "Episode V complete",
        fullTitle: "The reveal on Cloud City",
        description:
          "Hoth, Yoda's training, Han's capture, and Vader's family revelation are unlocked.",
        spoilerName: true
      },
      {
        position: 6,
        safeTitle: "Episode VI complete",
        fullTitle: "Vader's redemption and the second Death Star",
        description:
          "The rescue from Jabba, the Battle of Endor, and the Emperor's defeat are open.",
        spoilerName: true
      },
      {
        position: 7,
        safeTitle: "Episode VII complete",
        fullTitle: "Starkiller Base and Han Solo's death",
        description:
          "Rey's awakening, Kylo Ren's choice, and the battle at Starkiller Base are unlocked.",
        spoilerName: true
      },
      {
        position: 8,
        safeTitle: "Episode VIII complete",
        fullTitle: "Luke's stand on Crait",
        description:
          "Rey's parentage claim, Snoke's throne room, and Luke's final stand are open.",
        spoilerName: true
      },
      {
        position: 9,
        safeTitle: "Episode IX complete",
        fullTitle: "Exegol and the end of the Skywalker Saga",
        description:
          "Palpatine's return, Rey's heritage, and the final confrontation are unlocked.",
        spoilerName: true
      }
    ]
  },
  {
    key: "lordOfTheRings",
    title: "The Fellowship Reading Room",
    linkName: "the-fellowship-reading-room",
    description:
      "An invite-only journey from the Shire to Mount Doom, one famous turning point at a time.",
    category: "BOOKS",
    visibility: "INVITE_ONLY",
    rules:
      "Invitees should set progress immediately. Protect character deaths, identities, separations, and the Ring's final fate behind the correct checkpoint.",
    milestones: [
      {
        position: 1,
        safeTitle: "Leaving the Shire",
        fullTitle: "Bilbo's party and Frodo's departure",
        description:
          "The Ring passes to Frodo and the journey out of Hobbiton begins.",
        spoilerName: false
      },
      {
        position: 2,
        safeTitle: "The road to Rivendell",
        fullTitle: "Weathertop and the flight to Rivendell",
        description:
          "The Black Riders, Strider's guidance, and Frodo's wound are unlocked.",
        spoilerName: false
      },
      {
        position: 3,
        safeTitle: "The company is chosen",
        fullTitle: "The Council of Elrond and the Fellowship",
        description:
          "The Ring's history and the formation of the Fellowship are open for discussion.",
        spoilerName: false
      },
      {
        position: 4,
        safeTitle: "The underground passage",
        fullTitle: "Moria, the Balrog, and Gandalf's fall",
        description:
          "The journey through Moria and the confrontation on the bridge are unlocked.",
        spoilerName: true
      },
      {
        position: 5,
        safeTitle: "The Fellowship divides",
        fullTitle: "Boromir's death and the breaking of the Fellowship",
        description:
          "Amon Hen, Boromir's last stand, and the separated paths are open.",
        spoilerName: true
      },
      {
        position: 6,
        safeTitle: "The battle for Rohan",
        fullTitle: "Helm's Deep and Isengard's fall",
        description:
          "The defense of Helm's Deep and the Ents' march can be discussed freely.",
        spoilerName: false
      },
      {
        position: 7,
        safeTitle: "The hidden pass",
        fullTitle: "Shelob's lair and Sam carrying the Ring",
        description:
          "Gollum's trap, Shelob's attack, and Sam's choice are unlocked.",
        spoilerName: true
      },
      {
        position: 8,
        safeTitle: "The final battle",
        fullTitle: "The Pelennor Fields and the Black Gate",
        description:
          "The defense of Minas Tirith and Aragorn's march on Mordor are open.",
        spoilerName: false
      },
      {
        position: 9,
        safeTitle: "The journey's end",
        fullTitle: "Gollum destroys the Ring and the Grey Havens",
        description:
          "The Ring's destruction, the return to the Shire, and Frodo's departure are unlocked.",
        spoilerName: true
      }
    ]
  }
];

export const showcaseInviteToken =
  "bG9yZXNhZmUtc2hvd2Nhc2UtbG90ci1pbnZpdGUtdjE";

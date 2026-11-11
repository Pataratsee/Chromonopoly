# Model colour audit

Generated 2026-11-11T01:08:48.456Z by `scripts/audit-model-colors.ts`.

- Checked: **136** GLBs
- Passed: **136**
- Failed: **0**

A model fails if a primitive has no material, a material is pure white/flat grey without a texture or vertex colour, a material is fully transparent, a texture is a 1x1 canvas, or a textured primitive has no UVs. Dark charcoal/black outlines are not treated as grey placeholders.

| Kind | Model | Materials | Textured prims | Vertex-colour prims | Result |
|---|---|---:|---:|---:|---|
| token | sedan | 1 | 3 | 0 | PASS |
| token | hatchback | 1 | 3 | 0 | PASS |
| token | racecar | 1 | 3 | 0 | PASS |
| token | futureracer | 1 | 3 | 0 | PASS |
| token | taxi | 1 | 3 | 0 | PASS |
| token | police | 1 | 4 | 0 | PASS |
| token | ambulance | 1 | 5 | 0 | PASS |
| token | firetruck | 1 | 4 | 0 | PASS |
| token | delivery | 1 | 4 | 0 | PASS |
| token | garbage | 1 | 5 | 0 | PASS |
| token | tractor | 1 | 5 | 0 | PASS |
| token | boxtruck | 1 | 3 | 0 | PASS |
| token | van | 1 | 3 | 0 | PASS |
| token | luxurysuv | 1 | 3 | 0 | PASS |
| token | kart | 1 | 4 | 0 | PASS |
| token | speedster | 1 | 5 | 0 | PASS |
| token | cat | 1 | 7 | 0 | PASS |
| token | dog | 1 | 5 | 0 | PASS |
| token | fox | 1 | 6 | 0 | PASS |
| token | panda | 1 | 5 | 0 | PASS |
| token | penguin | 1 | 5 | 0 | PASS |
| token | elephant | 1 | 6 | 0 | PASS |
| token | giraffe | 1 | 5 | 0 | PASS |
| token | lion | 1 | 6 | 0 | PASS |
| token | monkey | 1 | 6 | 0 | PASS |
| token | koala | 1 | 5 | 0 | PASS |
| token | parrot | 1 | 7 | 0 | PASS |
| token | polar | 1 | 5 | 0 | PASS |
| token | tiger | 1 | 6 | 0 | PASS |
| token | deer | 1 | 5 | 0 | PASS |
| token | bunny | 1 | 5 | 0 | PASS |
| token | pig | 1 | 6 | 0 | PASS |
| token | bee | 1 | 7 | 0 | PASS |
| token | fish | 1 | 3 | 0 | PASS |
| token | chick | 1 | 5 | 0 | PASS |
| token | crab | 1 | 6 | 0 | PASS |
| token | burger | 1 | 6 | 0 | PASS |
| token | donut | 1 | 1 | 0 | PASS |
| token | coffee | 1 | 1 | 0 | PASS |
| token | cupcake | 1 | 3 | 0 | PASS |
| token | cake | 1 | 6 | 0 | PASS |
| token | pineapple | 1 | 1 | 0 | PASS |
| token | mushroom | 1 | 1 | 0 | PASS |
| token | taco | 1 | 1 | 0 | PASS |
| token | icecream | 1 | 2 | 0 | PASS |
| token | sushi | 1 | 1 | 0 | PASS |
| token | croissant | 1 | 1 | 0 | PASS |
| token | watermelon | 1 | 8 | 0 | PASS |
| token | chest | 1 | 2 | 0 | PASS |
| token | cannon | 1 | 3 | 0 | PASS |
| token | barrel | 1 | 1 | 0 | PASS |
| token | crate | 1 | 1 | 0 | PASS |
| token | flag | 1 | 1 | 0 | PASS |
| token | candycane | 1 | 1 | 0 | PASS |
| token | present | 1 | 2 | 0 | PASS |
| token | dreidel | 1 | 1 | 0 | PASS |
| token | lantern | 1 | 1 | 0 | PASS |
| token | snowman | 1 | 1 | 0 | PASS |
| token | nutcracker | 1 | 1 | 0 | PASS |
| token | radio | 3 | 0 | 0 | PASS |
| token | laptop | 3 | 0 | 0 | PASS |
| token | speaker | 2 | 0 | 0 | PASS |
| token | bench | 1 | 0 | 0 | PASS |
| token | cashregister | 1 | 1 | 0 | PASS |
| token | sailboat | 1 | 2 | 0 | PASS |
| token | locomotive | 1 | 6 | 0 | PASS |
| token | marble | 1 | 0 | 0 | PASS |
| token | tower | 1 | 1 | 0 | PASS |
| token | astronaut | 7 | 0 | 0 | PASS |
| token | rover | 4 | 0 | 0 | PASS |
| token | satellite | 5 | 0 | 0 | PASS |
| token | catapult | 1 | 6 | 0 | PASS |
| building | house | 1 | 1 | 0 | PASS |
| building | apartments | 1 | 1 | 0 | PASS |
| building | shop | 1 | 1 | 0 | PASS |
| building | restaurant | 1 | 1 | 0 | PASS |
| building | office | 1 | 1 | 0 | PASS |
| building | hotel | 1 | 1 | 0 | PASS |
| building | landmark | 1 | 1 | 0 | PASS |
| prop | palm | 1 | 1 | 0 | PASS |
| prop | palmbend | 1 | 1 | 0 | PASS |
| prop | jailbars | 1 | 1 | 0 | PASS |
| prop | rock | 1 | 1 | 0 | PASS |
| building | city-a | 1 | 1 | 0 | PASS |
| building | city-b | 1 | 1 | 0 | PASS |
| building | city-c | 1 | 1 | 0 | PASS |
| building | city-d | 1 | 1 | 0 | PASS |
| building | city-e | 1 | 1 | 0 | PASS |
| building | city-f | 1 | 1 | 0 | PASS |
| building | city-g | 1 | 1 | 0 | PASS |
| building | city-h | 1 | 1 | 0 | PASS |
| building | city-i | 1 | 1 | 0 | PASS |
| building | suburb-a | 1 | 1 | 0 | PASS |
| building | suburb-b | 1 | 1 | 0 | PASS |
| building | suburb-c | 1 | 1 | 0 | PASS |
| building | suburb-d | 1 | 1 | 0 | PASS |
| building | city-far-a | 1 | 1 | 0 | PASS |
| building | city-far-b | 1 | 1 | 0 | PASS |
| building | city-far-c | 1 | 1 | 0 | PASS |
| building | city-far-d | 1 | 1 | 0 | PASS |
| building | building-e | 1 | 1 | 0 | PASS |
| building | building-g | 1 | 1 | 0 | PASS |
| building | building-i | 1 | 1 | 0 | PASS |
| building | building-j | 1 | 1 | 0 | PASS |
| building | building-l | 1 | 1 | 0 | PASS |
| building | skyscraper-a | 1 | 1 | 0 | PASS |
| building | type-c | 1 | 1 | 0 | PASS |
| building | type-d | 1 | 1 | 0 | PASS |
| token | apple | 1 | 1 | 0 | PASS |
| token | banana | 1 | 1 | 0 | PASS |
| token | bread | 1 | 1 | 0 | PASS |
| token | carrot | 1 | 1 | 0 | PASS |
| token | cheese | 1 | 12 | 0 | PASS |
| token | cherries | 1 | 1 | 0 | PASS |
| token | cookie | 1 | 1 | 0 | PASS |
| token | corn | 1 | 1 | 0 | PASS |
| token | noodles | 1 | 3 | 0 | PASS |
| token | ketchup | 1 | 1 | 0 | PASS |
| token | soup | 1 | 1 | 0 | PASS |
| token | avocado | 1 | 1 | 0 | PASS |
| token | broccoli | 1 | 1 | 0 | PASS |
| token | chocolate | 1 | 1 | 0 | PASS |
| token | bookcase | 1 | 0 | 0 | PASS |
| token | deskchair | 2 | 0 | 0 | PASS |
| token | monitor | 2 | 0 | 0 | PASS |
| token | desk | 2 | 0 | 0 | PASS |
| token | fridge | 4 | 0 | 0 | PASS |
| token | microwave | 4 | 0 | 0 | PASS |
| token | stove | 5 | 0 | 0 | PASS |
| token | bathtub | 3 | 0 | 0 | PASS |
| token | alien | 5 | 0 | 0 | PASS |
| token | astronautb | 5 | 0 | 0 | PASS |
| token | spaceracer | 4 | 0 | 0 | PASS |
| token | speeder | 4 | 0 | 0 | PASS |
| token | meteor | 1 | 0 | 0 | PASS |
| token | monorail | 4 | 0 | 0 | PASS |

## Failures

None. Every shipped model has a deliberate colour source.

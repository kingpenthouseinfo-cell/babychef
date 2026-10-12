import { DirtyForm, SubmitBtn } from './client';
import { Area, Check, Text } from './ui';
import { saveBabyChef } from '@/lib/actions/babychef';

export type ChefPart = 'all' | 'details' | 'voice' | 'kitchen' | 'rules';

export function BabyChefForm({ b, part = 'all' }: { b?: any; part?: ChefPart }) {
  const show = (p: ChefPart) => part === 'all' || part === p;
  return (
    <DirtyForm action={saveBabyChef} className="space-y-5">
      {b && <input type="hidden" name="id" value={b.id} />}
      {show('details') && <><div className="card grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="_hasActive" value="1" />
        <Text name="displayName" label="Display name *" v={b?.displayName} required />
        <Text name="seriesName" label="Series name" v={b?.seriesName} />
        <Text name="cuisine" label="Cuisine association" v={b?.cuisine} />
        <Text name="age" label="Age description" v={b?.age} placeholder="e.g. approximately one year old" />
        <Text name="gender" label="Gender" v={b?.gender} />
        <div className="flex items-end"><Check name="active" label="Active" v={b ? b.active : true} /></div>
      </div>
      <div className="card grid gap-3 sm:grid-cols-2">
        <h2 className="sm:col-span-2">Appearance</h2>
        <Area name="appearance" label="Appearance" v={b?.appearance} />
        <Area name="skinTone" label="Skin tone" v={b?.skinTone} />
        <Area name="facialFeatures" label="Facial features" v={b?.facialFeatures} />
        <Area name="hair" label="Hair" v={b?.hair} />
        <Area name="bodyNotes" label="Body / proportion notes" v={b?.bodyNotes} />
        <Area name="outfit" label="Chef outfit" v={b?.outfit} />
        <Area name="accessories" label="Accessories" v={b?.accessories} />
      </div></>}
      {show('voice') && <div className="card grid gap-3 sm:grid-cols-2">
        <h2 className="sm:col-span-2">Personality & voice</h2>
        <Area name="personality" label="Personality" v={b?.personality} />
        <Area name="dialogueStyle" label="Dialogue style" v={b?.dialogueStyle} />
        <Area name="voiceInstruction" label="Voice / accent instruction" v={b?.voiceInstruction} />
        <Area name="recurringJokes" label="Recurring jokes" v={b?.recurringJokes} />
        <Area name="recurringReacts" label="Recurring reactions" v={b?.recurringReacts} />
        <Area name="behaviorNotes" label="Behavior notes" v={b?.behaviorNotes} />
        <Area name="humorPatterns" label="Humor patterns" v={b?.humorPatterns} hint="Included automatically in Production Plan prompts" />
        <Area name="typicalExpressions" label="Typical expressions" v={b?.typicalExpressions} />
        <Area name="ingredientReactions" label="Ingredient reactions" v={b?.ingredientReactions} placeholder="e.g. suspicious of Scotch bonnet; delighted by butter" />
        <Area name="ctaBehavior" label="Character-specific CTA behavior" v={b?.ctaBehavior} />
        <Area name="culturalNotes" label="Cultural / language notes" v={b?.culturalNotes} />
      </div>}
      {show('kitchen') && <div className="card grid gap-3 sm:grid-cols-2">
        <h2 className="sm:col-span-2">Kitchen</h2>
        <Area name="kitchen" label="Kitchen description" v={b?.kitchen} />
        <Area name="lighting" label="Lighting description" v={b?.lighting} />
        <Area name="cinematography" label="Cinematography notes" v={b?.cinematography} className="sm:col-span-2" />
      </div>}
      {show('rules') && <div className="card grid gap-3 sm:grid-cols-2">
        <h2 className="sm:col-span-2">Production rules</h2>
        <Area name="safetyRules" label="Safety rules" v={b?.safetyRules} />
        <Area name="continuityRules" label="General continuity rules" v={b?.continuityRules} />
      </div>}
      <div className="sticky bottom-0 -mx-4 border-t border-line bg-paper/95 px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0"><SubmitBtn>SAVE BABY CHEF</SubmitBtn></div>
    </DirtyForm>
  );
}

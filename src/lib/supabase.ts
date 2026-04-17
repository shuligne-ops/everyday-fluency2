import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Lesson = {
  id: number;
  level: string;
  lesson_number: number;
  title_fr: string;
  title_ru: string;
  content: {
    step1: {
      phrase_fr: string;
      phrase_ru: string;
      explanation_fr: string;
      example_fr: string;
    };
    step2: {
      dialogue_with_names: string[];
    };
    step3: {
      comprehension: { question: string; answer: string }[];
      vocab: { word: string; explanation_fr: string; translation_ru: string }[];
      culture_note: string;
      grammar_micro: string;
    };
    step4: {
      dialogue_no_names: string[];
    };
    step5: {
      scenario: string;
      models: string[];
    };
  };
};

export async function getLessons(level: string): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('level', level)
    .order('lesson_number');

  if (error) throw error;
  return data as Lesson[];
}

export async function getLesson(level: string, lessonNumber: number): Promise<Lesson | null> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('level', level)
    .eq('lesson_number', lessonNumber)
    .single();

  if (error) return null;
  return data as Lesson;
}

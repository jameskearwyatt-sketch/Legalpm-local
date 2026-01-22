import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

interface EnrichmentResult {
  gender?: 'male' | 'female' | 'unknown';
  company?: string;
  country?: string;
  city?: string;
  job_title?: string;
  sectors?: string[];
  linkedin_url?: string;
  email?: string;
  email_status?: string;
  sic_codes?: string[];
  naics_codes?: string[];
  company_keywords?: string[];
  confidence: {
    gender?: number;
    location?: number;
    sector?: number;
  };
  sources: string[];
}

interface EnrichContactParams {
  contactId: string;
  fullName: string;
  email: string;
  linkedinUrl?: string | null;
  company?: string | null;
  // Current values for history tracking
  currentJobTitle?: string | null;
  currentCompany?: string | null;
  currentCountry?: string | null;
  currentCity?: string | null;
}

// Helper to log history entries
async function logHistoryChanges(
  userId: string,
  contactId: string,
  changes: { fieldName: string; oldValue: string | null; newValue: string | null }[],
  changeSource: 'manual' | 'enrichment' | 'import' = 'enrichment'
) {
  if (changes.length === 0) return;

  const records = changes.map((c) => ({
    contact_id: contactId,
    user_id: userId,
    field_name: c.fieldName,
    old_value: c.oldValue,
    new_value: c.newValue,
    change_source: changeSource,
  }));

  await supabase.from("distribution_contact_history").insert(records);
}

export function useEnrichContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: EnrichContactParams): Promise<EnrichmentResult & { params: EnrichContactParams }> => {
      const { data, error } = await supabase.functions.invoke('enrich-contact', {
        body: params,
      });

      if (error) {
        throw new Error(error.message || 'Failed to enrich contact');
      }

      if (!data.success) {
        throw new Error(data.error || 'Enrichment failed');
      }

      return { ...data.data, params };
    },
    onSuccess: async (result) => {
      if (!user) return;
      
      const params = result.params;
      
      // Update the contact with enriched data
      const updates: Record<string, unknown> = {
        last_enriched_at: new Date().toISOString(),
      };
      
      // Track changes for history
      const historyChanges: { fieldName: string; oldValue: string | null; newValue: string | null }[] = [];
      
      if (result.gender && result.gender !== 'unknown') {
        updates.gender = result.gender;
      }
      if (result.company && result.company !== params.currentCompany) {
        historyChanges.push({
          fieldName: 'company',
          oldValue: params.currentCompany || null,
          newValue: result.company,
        });
        updates.company = result.company;
      }
      if (result.country && result.country !== params.currentCountry) {
        historyChanges.push({
          fieldName: 'country',
          oldValue: params.currentCountry || null,
          newValue: result.country,
        });
        updates.country = result.country;
      }
      if (result.city && result.city !== params.currentCity) {
        historyChanges.push({
          fieldName: 'city',
          oldValue: params.currentCity || null,
          newValue: result.city,
        });
        updates.city = result.city;
      }
      if (result.job_title && result.job_title !== params.currentJobTitle) {
        historyChanges.push({
          fieldName: 'job_title',
          oldValue: params.currentJobTitle || null,
          newValue: result.job_title,
        });
        updates.job_title = result.job_title;
      }
      if (result.sectors && result.sectors.length > 0) {
        updates.sectors = result.sectors;
        updates.sectors_ai_assigned = true;
      }
      if (result.linkedin_url) {
        updates.linkedin_url = result.linkedin_url;
      }
      if (result.email) {
        updates.email = result.email;
      }
      if (result.email_status) {
        updates.email_status = result.email_status;
      }
      if (result.sic_codes && result.sic_codes.length > 0) {
        updates.sic_codes = result.sic_codes;
      }
      if (result.naics_codes && result.naics_codes.length > 0) {
        updates.naics_codes = result.naics_codes;
      }
      if (result.company_keywords && result.company_keywords.length > 0) {
        updates.company_keywords = result.company_keywords;
      }

      // Always update (at least last_enriched_at)
      const { error } = await supabase
        .from('distribution_contacts')
        .update(updates)
        .eq('id', params.contactId);

      if (error) {
        console.error('Failed to update contact:', error);
        toast.error('Enrichment data found but failed to save');
        return;
      }

      // Log history changes
      if (historyChanges.length > 0) {
        await logHistoryChanges(user.id, params.contactId, historyChanges, 'enrichment');
      }

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['distribution-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-history', params.contactId] });
      
      const fieldsUpdated = Object.keys(updates).filter(k => k !== 'sectors_ai_assigned' && k !== 'last_enriched_at');
      if (fieldsUpdated.length > 0) {
        toast.success(`Enriched: ${fieldsUpdated.join(', ')}`, {
          description: `Sources: ${result.sources.join(', ')}`,
        });
      } else {
        toast.info('No new data found to enrich');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to enrich contact');
    },
  });
}

export function useBulkEnrichContacts() {
  const enrichContact = useEnrichContact();

  return useMutation({
    mutationFn: async (contacts: EnrichContactParams[]) => {
      const results: { contactId: string; success: boolean; error?: string }[] = [];
      
      // Process in batches of 3 to avoid rate limits
      for (let i = 0; i < contacts.length; i += 3) {
        const batch = contacts.slice(i, i + 3);
        const batchResults = await Promise.allSettled(
          batch.map(contact => enrichContact.mutateAsync(contact))
        );
        
        batchResults.forEach((result, idx) => {
          const contact = batch[idx];
          if (result.status === 'fulfilled') {
            results.push({ contactId: contact.contactId, success: true });
          } else {
            results.push({ 
              contactId: contact.contactId, 
              success: false, 
              error: result.reason?.message 
            });
          }
        });
        
        // Small delay between batches
        if (i + 3 < contacts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      return results;
    },
  });
}

// Comprehensive male/female name database for gender inference (matches edge function)
const maleNames = new Set([
  'james', 'john', 'robert', 'michael', 'david', 'william', 'richard', 'joseph', 'thomas', 'charles',
  'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua',
  'kenneth', 'kevin', 'brian', 'george', 'timothy', 'ronald', 'edward', 'jason', 'jeffrey', 'ryan',
  'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon',
  'benjamin', 'samuel', 'raymond', 'gregory', 'frank', 'alexander', 'patrick', 'jack', 'dennis', 'jerry',
  'peter', 'henry', 'carl', 'arthur', 'roger', 'joe', 'juan', 'albert', 'willie', 'bruce',
  'adam', 'harry', 'ralph', 'eugene', 'randy', 'philip', 'howard', 'vincent', 'russell', 'louis',
  'martin', 'oliver', 'leo', 'max', 'lucas', 'ethan', 'noah', 'liam', 'mason', 'logan',
  'tom', 'mike', 'chris', 'dan', 'matt', 'nick', 'alex', 'ben', 'sam', 'steve',
  'ian', 'sean', 'connor', 'dylan', 'cole', 'luke', 'tyler', 'caleb', 'hunter', 'aaron',
  'nathan', 'isaac', 'jordan', 'cameron', 'blake', 'austin', 'evan', 'gavin', 'chase', 'parker',
  'miles', 'owen', 'eli', 'xavier', 'adrian', 'tristan', 'elliot', 'grant', 'spencer', 'trevor',
  'derek', 'ross', 'neil', 'craig', 'doug', 'todd', 'chad', 'brad', 'troy', 'brett',
  'gordon', 'stuart', 'graham', 'alan', 'keith', 'colin', 'barry', 'wayne', 'glenn', 'darren',
  'simon', 'marcus', 'dominic', 'toby', 'rupert', 'nigel', 'clive', 'geoffrey', 'hugh', 'alistair',
  'mohammed', 'muhammad', 'ahmed', 'ali', 'omar', 'hassan', 'hussein', 'khalid', 'tariq', 'amir',
  'yusuf', 'ibrahim', 'ismail', 'abdullah', 'abdul', 'mustafa', 'rashid', 'faisal', 'hamid', 'karim',
  'samir', 'nasser', 'walid', 'ziad', 'adel', 'khaled', 'maher', 'hisham', 'bassam', 'wael',
  'rami', 'sami', 'nabil', 'majid', 'jamal', 'salim', 'fahad', 'nawaf', 'sultan', 'badr',
  'ehab', 'amr', 'sherif', 'tarek', 'hossam', 'ashraf', 'hazem', 'akram', 'essam', 'emad',
  'raj', 'amit', 'vijay', 'rahul', 'sanjay', 'suresh', 'ravi', 'kumar', 'arun', 'vikram',
  'anand', 'ashok', 'deepak', 'dinesh', 'ganesh', 'girish', 'gopal', 'harish', 'kiran', 'krishna',
  'mahesh', 'manoj', 'mohan', 'mukesh', 'naresh', 'nitin', 'pankaj', 'praveen', 'rajesh', 'rakesh',
  'ramesh', 'rohit', 'sachin', 'sandeep', 'satish', 'shekhar', 'sunil', 'vinod', 'vivek', 'yogesh',
  'aditya', 'akash', 'ankur', 'arjun', 'arnav', 'dhruv', 'gaurav', 'harsh', 'ishaan', 'kabir',
  'manish', 'mayank', 'mohit', 'nikhil', 'nishant', 'pratik', 'prateek', 'rishabh', 'rohan', 'sahil',
  'shivam', 'sidharth', 'siddharth', 'varun', 'vishal', 'yash', 'aarav', 'ayush', 'kartik', 'kunal',
  'imran', 'asif', 'farhan', 'bilal', 'usman', 'zubair', 'adnan', 'nadeem', 'wasim', 'kamran',
  'wei', 'chen', 'ming', 'jun', 'hong', 'lei', 'yong', 'feng', 'jian', 'xin',
  'bo', 'chao', 'gang', 'hao', 'hui', 'kai', 'lin', 'peng', 'qiang', 'tao',
  'wen', 'xiang', 'yang', 'yu', 'zhi', 'zhong', 'dong', 'guang', 'hai', 'jie',
  'liang', 'long', 'nan', 'ping', 'qing', 'rong', 'shan', 'sheng', 'shi', 'song',
  'chang', 'cheng', 'da', 'de', 'fu', 'guo', 'hua', 'jing', 'ke', 'kang',
  'zheng', 'bin', 'biao', 'cong', 'deng', 'fei', 'heng', 'jianwei', 'jianjun', 'jianguo',
  'shirvine', 'shawn', 'tony', 'jerry', 'andy', 'eric', 'kevin', 'david', 'jason', 'frank',
  'hiroshi', 'takeshi', 'kenji', 'ken', 'taro', 'akira', 'naoki', 'koji', 'daisuke', 'takahiro',
  'yusuke', 'ryota', 'kenta', 'shota', 'kazuki', 'daiki', 'yuta', 'sho', 'ryo', 'masashi',
  'tetsuya', 'kazuya', 'yuichi', 'shinichi', 'tomohiro', 'yoshihiro', 'masahiro', 'kazuhiro', 'nobuhiro', 'takuya',
  'satoshi', 'atsushi', 'takashi', 'makoto', 'kenichi', 'koichi', 'yuji', 'shinji', 'junichi', 'shuji',
  'minho', 'jinho', 'junho', 'jaehyun', 'seungho', 'donghoon', 'jungwoo', 'sangwoo', 'hyunwoo', 'taehyun',
  'jihoon', 'sunghoon', 'kyungho', 'young', 'sung', 'joon', 'min', 'hyun', 'woo', 'seok',
  'jinwoo', 'sungmin', 'youngho', 'dongwook', 'junhyuk', 'sangmin', 'hyunsoo', 'jinhyuk', 'seungjun', 'minwoo',
  'stefan', 'hans', 'klaus', 'wolfgang', 'andreas', 'markus', 'jurgen', 'dieter', 'jorg', 'uwe',
  'ralf', 'bernd', 'dirk', 'thorsten', 'matthias', 'christoph', 'florian', 'tobias', 'sebastian',
  'johannes', 'jan', 'lars', 'sven', 'hendrik', 'till', 'moritz', 'felix', 'lukas', 'jonas',
  'jean', 'pierre', 'michel', 'francois', 'jacques', 'philippe', 'marc', 'laurent', 'nicolas', 'antoine',
  'guillaume', 'christophe', 'thierry', 'alain', 'pascal', 'olivier', 'bruno', 'serge', 'rene', 'yves',
  'benoit', 'julien', 'cedric', 'fabien', 'maxime', 'romain', 'quentin', 'hugo', 'louis', 'baptiste',
  'carlos', 'jose', 'luis', 'miguel', 'antonio', 'francisco', 'pedro', 'manuel', 'rafael', 'jorge',
  'fernando', 'pablo', 'alejandro', 'javier', 'enrique', 'ricardo', 'andres', 'sergio', 'raul', 'alberto',
  'diego', 'ruben', 'ivan', 'alvaro', 'guillermo', 'mario', 'victor', 'eduardo', 'alfonso', 'ramon',
  'joao', 'tiago', 'andre', 'nuno', 'rui', 'paulo', 'vitor',
  'marco', 'giuseppe', 'giovanni', 'luca', 'francesco', 'andrea', 'alessandro', 'matteo', 'davide', 'simone',
  'fabio', 'stefano', 'roberto', 'massimo', 'maurizio', 'claudio', 'daniele', 'paolo', 'riccardo', 'nicola',
  'pieter', 'henk', 'willem', 'gerrit', 'jeroen', 'bas', 'joost', 'wouter', 'maarten',
  'erik', 'magnus', 'anders', 'johan', 'olof', 'soren', 'morten', 'bjorn', 'thor', 'leif',
  'piotr', 'pawel', 'tomasz', 'krzysztof', 'marcin', 'michal', 'jakub', 'maciej', 'lukasz',
  'andrzej', 'wojciech', 'grzegorz', 'rafal', 'mariusz', 'dariusz', 'artur', 'kamil', 'mateusz', 'bartosz',
  'dmitri', 'sergei', 'mikhail', 'alexei', 'vladimir', 'boris', 'oleg', 'yuri', 'viktor',
  'kwame', 'kofi', 'ade', 'chidi', 'emeka', 'obinna', 'chibuzo', 'oluwole', 'babatunde', 'olumide',
  'segun', 'tunde', 'femi', 'tobi', 'yemi', 'bola', 'kunle', 'wale', 'dele', 'jide',
  'thabo', 'sipho', 'themba', 'mandla', 'bongani', 'sibusiso', 'sifiso', 'mthunzi', 'nkosinathi', 'kagiso',
  'yosef', 'moshe', 'yakov', 'avraham', 'shlomo', 'itzhak', 'avi', 'eitan', 'alon',
  'roi', 'guy', 'oren', 'tal', 'nadav', 'yuval', 'nir', 'gal', 'idan',
  'mehmet', 'ahmet', 'hasan', 'huseyin', 'murat', 'osman',
  'can', 'cem', 'emre', 'burak', 'baris', 'tolga', 'serkan', 'kerem', 'onur', 'arda'
]);

const femaleNames = new Set([
  'mary', 'patricia', 'jennifer', 'linda', 'barbara', 'elizabeth', 'susan', 'jessica', 'sarah', 'karen',
  'lisa', 'nancy', 'betty', 'margaret', 'sandra', 'ashley', 'kimberly', 'emily', 'donna', 'michelle',
  'dorothy', 'carol', 'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon', 'laura', 'cynthia',
  'kathleen', 'amy', 'angela', 'shirley', 'anna', 'brenda', 'pamela', 'emma', 'nicole', 'helen',
  'samantha', 'katherine', 'christine', 'debra', 'rachel', 'carolyn', 'janet', 'catherine', 'maria', 'heather',
  'diane', 'ruth', 'julie', 'olivia', 'joyce', 'virginia', 'victoria', 'kelly', 'lauren', 'christina',
  'joan', 'evelyn', 'judith', 'megan', 'cheryl', 'hannah', 'jacqueline', 'martha', 'gloria', 'teresa',
  'ann', 'sara', 'madison', 'frances', 'kathryn', 'janice', 'abigail', 'alice', 'judy', 'grace',
  'sophia', 'chloe', 'isabella', 'charlotte', 'mia', 'amelia', 'harper', 'aria', 'ella', 'scarlett',
  'natalie', 'zoey', 'lily', 'penelope', 'layla', 'riley', 'nora', 'eleanor', 'hazel', 'aurora',
  'allison', 'audrey', 'claire', 'stella', 'bella', 'lucy', 'leah', 'savannah', 'brooklyn',
  'jill', 'wendy', 'kate', 'beth', 'anne', 'sue', 'kim', 'tina', 'gina', 'dana',
  'molly', 'holly', 'sally', 'tracy', 'stacy', 'carrie', 'terri', 'jenny', 'vicky', 'cindy',
  'bonnie', 'tammy', 'denise', 'renee', 'tiffany', 'brittany', 'crystal', 'brandy', 'amber', 'brooke',
  'fiona', 'sienna', 'willow', 'ivy', 'piper', 'jade', 'maya', 'daisy', 'violet', 'ruby',
  'fatima', 'aisha', 'mariam', 'zahra', 'noor', 'hana', 'yasmin', 'amira',
  'leila', 'dina', 'mona', 'rania', 'dalal', 'huda', 'lubna', 'wafa', 'mai', 'dalia',
  'rana', 'reem', 'noura', 'abeer', 'asma', 'hadeel', 'manal', 'lina', 'yara', 'ghadeer',
  'maha', 'eman', 'heba', 'nesreen', 'sahar', 'sherine', 'ghada', 'samira', 'nawal', 'afaf',
  'priya', 'anita', 'sunita', 'rekha', 'meena', 'deepa', 'kavita', 'neha', 'pooja', 'divya',
  'anjali', 'asha', 'geeta', 'indira', 'jaya', 'kamla', 'lata', 'mala', 'nandini', 'padma',
  'radha', 'rani', 'ritu', 'seema', 'shanti', 'shobha', 'sudha', 'uma', 'usha', 'vidya',
  'aditi', 'aishwarya', 'ananya', 'archana', 'bhavna', 'chitra', 'devika', 'dipti', 'garima', 'harini',
  'isha', 'jyoti', 'kritika', 'madhuri', 'manisha', 'megha', 'mitali', 'namita', 'nidhi', 'pallavi',
  'preeti', 'rashmi', 'sakshi', 'sangeeta', 'shruti', 'sneha', 'swati', 'tanvi', 'tanya',
  'ayesha', 'sana', 'zainab', 'farzana', 'nadia', 'shabnam', 'shazia', 'tahira', 'uzma', 'fatema',
  'yan', 'li', 'fang', 'xia', 'ying', 'mei', 'lan', 'na', 'hua',
  'jing', 'qian', 'ting', 'xue', 'yun', 'zhen', 'chun', 'ling', 'rong',
  'juan', 'fen', 'qin', 'shu', 'xiao', 'yi', 'lei',
  'lu', 'dan', 'ning', 'sha', 'yuan', 'ai', 'bi', 'cui', 'fan',
  'shirveen', 'shirley', 'vivian', 'connie',
  'winnie', 'maggie', 'candy', 'sunny', 'betty',
  'yuki', 'sakura', 'akiko', 'yoko', 'keiko', 'hiroko', 'michiko', 'naomi', 'mari', 'emi',
  'haruka', 'ayumi', 'yui', 'miki', 'rika', 'nana', 'sayaka', 'mayumi', 'tomoko', 'yukiko',
  'kazuko', 'kumiko', 'noriko', 'reiko', 'sachiko', 'satoko', 'shizuka', 'takako', 'yasuko', 'yumiko',
  'aiko', 'asuka', 'chiaki', 'chika', 'eri', 'honoka', 'kaori', 'kayo', 'mao',
  'miho', 'misaki', 'momoko', 'nanami', 'rin', 'risa', 'saki', 'shiori', 'yuka', 'ayaka',
  'minji', 'jiwon', 'soyeon', 'yuna', 'hyejin', 'eunbi', 'suji', 'haein', 'jiyeon', 'sujin',
  'mina', 'sora', 'yerin', 'jihye', 'jiwoo', 'seohyun', 'eunji', 'hayoung',
  'katrin', 'claudia', 'sabine', 'petra', 'stefanie', 'monika',
  'lena', 'lea',
  'heike', 'ute', 'birgit', 'gabi', 'karin', 'ingrid', 'renate', 'ursula', 'elisabeth', 'eva',
  'marie', 'sophie', 'camille', 'nathalie', 'sylvie', 'isabelle', 'valerie', 'celine',
  'aurelie', 'emilie', 'pauline', 'manon', 'margaux', 'clemence',
  'lucie', 'marine', 'mathilde', 'jeanne', 'louise', 'juliette', 'helene', 'sandrine', 'delphine',
  'carmen', 'lucia', 'rosa', 'elena', 'isabel', 'ana', 'cristina', 'paula',
  'marta', 'beatriz', 'pilar', 'raquel', 'silvia', 'alicia', 'rocio', 'adriana', 'lorena',
  'julia', 'clara', 'alba', 'ines', 'irene', 'diana',
  'mariana', 'catarina', 'rita', 'sofia', 'leonor', 'joana', 'daniela', 'carolina',
  'giulia', 'francesca', 'valentina', 'chiara', 'elisa', 'alessia', 'martina', 'federica',
  'paola', 'roberta', 'monica', 'simona', 'barbara', 'patrizia',
  'sanne', 'lotte', 'fleur',
  'astrid', 'sigrid', 'annika', 'linnea', 'maja', 'frida', 'ebba',
  'katarzyna', 'malgorzata', 'agnieszka', 'krystyna', 'ewa', 'elzbieta', 'zofia',
  'aleksandra', 'joanna', 'dorota', 'beata', 'iwona', 'karolina', 'justyna', 'sylwia',
  'olga', 'natasha', 'tatiana', 'irina', 'svetlana', 'marina', 'yulia', 'ekaterina', 'anastasia',
  'adaeze', 'chioma', 'ngozi', 'nneka', 'obioma', 'chinwe', 'adanna', 'uju', 'amara', 'chiamaka',
  'abena', 'akua', 'ama', 'efua', 'yaa', 'adwoa', 'afua', 'akosua', 'adjoa',
  'thandi', 'nomvula', 'zanele', 'lindiwe', 'palesa', 'lerato', 'dineo', 'mpho', 'thandiwe', 'sibongile',
  'miriam', 'esther', 'rivka', 'yael', 'tamar', 'noa', 'shira',
  'michal', 'inbar', 'talia', 'keren', 'hila', 'liora', 'orly', 'ayelet', 'galit',
  'elif', 'zeynep', 'ayse', 'emine', 'hatice', 'merve', 'busra', 'selin', 'esra',
  'melis', 'derya', 'sibel', 'ceren', 'irem', 'gamze', 'tugba', 'ozge', 'ece', 'beren'
]);

function inferGenderFromName(fullName: string): 'male' | 'female' | 'unknown' {
  const firstName = fullName.trim().split(/\s+/)[0].toLowerCase();
  
  if (maleNames.has(firstName)) return 'male';
  if (femaleNames.has(firstName)) return 'female';
  
  // Normalize accents
  const normalized = firstName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalized !== firstName) {
    if (maleNames.has(normalized)) return 'male';
    if (femaleNames.has(normalized)) return 'female';
  }
  
  // Ending heuristics
  if (firstName.endsWith('a') && !['joshua', 'ezra', 'luca', 'elia', 'nikita'].includes(firstName)) {
    return 'female';
  }
  if (firstName.endsWith('ine') || firstName.endsWith('elle') || firstName.endsWith('ette')) {
    return 'female';
  }
  if (firstName.endsWith('o') && !['margo'].includes(firstName)) {
    return 'male';
  }
  if (firstName.endsWith('us') || firstName.endsWith('os')) {
    return 'male';
  }
  
  return 'unknown';
}

interface ContactForGender {
  id: string;
  full_name: string;
  gender: string;
}

export function useAssignGenders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contacts: ContactForGender[]) => {
      const unknownContacts = contacts.filter(c => c.gender === 'unknown');
      let updated = 0;
      
      for (const contact of unknownContacts) {
        const inferred = inferGenderFromName(contact.full_name);
        if (inferred !== 'unknown') {
          const { error } = await supabase
            .from('distribution_contacts')
            .update({ gender: inferred })
            .eq('id', contact.id);
          
          if (!error) updated++;
        }
      }
      
      return { updated, total: unknownContacts.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['distribution-contacts'] });
      if (result.updated > 0) {
        toast.success(`Assigned gender to ${result.updated} contacts`);
      } else {
        toast.info('No additional genders could be inferred');
      }
    },
    onError: () => {
      toast.error('Failed to assign genders');
    },
  });
}

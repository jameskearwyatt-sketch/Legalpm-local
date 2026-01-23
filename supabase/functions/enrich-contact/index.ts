const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichmentRequest {
  contactId: string;
  fullName: string;
  email: string;
  linkedinUrl?: string | null;
  company?: string | null;
}

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

interface ApolloPersonResponse {
  person?: {
    first_name?: string;
    last_name?: string;
    name?: string;
    title?: string;
    city?: string;
    state?: string;
    country?: string;
    linkedin_url?: string;
    email?: string;
    email_status?: string;
    organization?: {
      name?: string;
      industry?: string;
      primary_industry?: string;
      keywords?: string[];
      sic_codes?: string[];
      naics_codes?: string[];
      city?: string;
      state?: string;
      country?: string;
    };
    // Apollo often stores the CURRENT email in a nested contact object
    contact?: {
      email?: string;
      email_status?: string;
      organization_name?: string;
      city?: string;
      country?: string;
    };
    // Also check contact_emails array for the most current email
    contact_emails?: Array<{
      email?: string;
      email_status?: string;
      position?: number;
    }>;
  };
}

// Comprehensive male/female name database for gender inference
// Includes Western, Asian, Middle Eastern, South Asian, African, and Latin names
const maleNames = new Set([
  // Western - English
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
  // Middle Eastern & Arabic
  'mohammed', 'muhammad', 'ahmed', 'ali', 'omar', 'hassan', 'hussein', 'khalid', 'tariq', 'amir',
  'yusuf', 'ibrahim', 'ismail', 'abdullah', 'abdul', 'mustafa', 'rashid', 'faisal', 'hamid', 'karim',
  'samir', 'nasser', 'walid', 'ziad', 'adel', 'khaled', 'maher', 'hisham', 'bassam', 'wael',
  'rami', 'sami', 'nabil', 'majid', 'jamal', 'salim', 'fahad', 'nawaf', 'sultan', 'badr',
  'ehab', 'amr', 'sherif', 'tarek', 'hossam', 'ashraf', 'hazem', 'akram', 'essam', 'emad',
  // South Asian - Indian, Pakistani, Bangladeshi
  'raj', 'amit', 'vijay', 'rahul', 'sanjay', 'suresh', 'ravi', 'kumar', 'arun', 'vikram',
  'anand', 'ashok', 'deepak', 'dinesh', 'ganesh', 'girish', 'gopal', 'harish', 'kiran', 'krishna',
  'mahesh', 'manoj', 'mohan', 'mukesh', 'naresh', 'nitin', 'pankaj', 'praveen', 'rajesh', 'rakesh',
  'ramesh', 'rohit', 'sachin', 'sandeep', 'satish', 'shekhar', 'sunil', 'vinod', 'vivek', 'yogesh',
  'aditya', 'akash', 'ankur', 'arjun', 'arnav', 'dhruv', 'gaurav', 'harsh', 'ishaan', 'kabir',
  'manish', 'mayank', 'mohit', 'nikhil', 'nishant', 'pratik', 'prateek', 'rishabh', 'rohan', 'sahil',
  'shivam', 'sidharth', 'siddharth', 'varun', 'vishal', 'yash', 'aarav', 'ayush', 'kartik', 'kunal',
  'imran', 'asif', 'farhan', 'bilal', 'usman', 'zubair', 'adnan', 'nadeem', 'wasim', 'kamran',
  // East Asian - Chinese
  'wei', 'chen', 'ming', 'jun', 'hong', 'lei', 'yong', 'feng', 'jian', 'xin',
  'bo', 'chao', 'gang', 'hao', 'hui', 'kai', 'lin', 'peng', 'qiang', 'tao',
  'wen', 'xiang', 'yang', 'yu', 'zhi', 'zhong', 'dong', 'guang', 'hai', 'jie',
  'liang', 'long', 'nan', 'ping', 'qing', 'rong', 'shan', 'sheng', 'shi', 'song',
  'chang', 'cheng', 'da', 'de', 'fu', 'guo', 'hua', 'jing', 'ke', 'kang',
  'zheng', 'bin', 'biao', 'cong', 'deng', 'fei', 'heng', 'jianwei', 'jianjun', 'jianguo',
  'shirvine', 'shawn', 'tony', 'jerry', 'andy', 'eric', 'kevin', 'david', 'jason', 'frank',
  // East Asian - Japanese
  'hiroshi', 'takeshi', 'kenji', 'ken', 'taro', 'akira', 'naoki', 'koji', 'daisuke', 'takahiro',
  'yusuke', 'ryota', 'kenta', 'shota', 'kazuki', 'daiki', 'yuta', 'sho', 'ryo', 'masashi',
  'tetsuya', 'kazuya', 'yuichi', 'shinichi', 'tomohiro', 'yoshihiro', 'masahiro', 'kazuhiro', 'nobuhiro', 'takuya',
  'satoshi', 'atsushi', 'takashi', 'makoto', 'kenichi', 'koichi', 'yuji', 'shinji', 'junichi', 'shuji',
  // East Asian - Korean
  'minho', 'jinho', 'junho', 'jaehyun', 'seungho', 'donghoon', 'jungwoo', 'sangwoo', 'hyunwoo', 'taehyun',
  'jihoon', 'sunghoon', 'kyungho', 'young', 'sung', 'joon', 'min', 'hyun', 'woo', 'seok',
  'jinwoo', 'sungmin', 'youngho', 'dongwook', 'junhyuk', 'sangmin', 'hyunsoo', 'jinhyuk', 'seungjun', 'minwoo',
  // European - German
  'stefan', 'hans', 'klaus', 'wolfgang', 'andreas', 'markus', 'jurgen', 'dieter', 'jorg', 'uwe',
  'ralf', 'bernd', 'frank', 'dirk', 'thorsten', 'matthias', 'christoph', 'florian', 'tobias', 'sebastian',
  'johannes', 'jan', 'lars', 'sven', 'hendrik', 'till', 'moritz', 'felix', 'lukas', 'jonas',
  // European - French
  'jean', 'pierre', 'michel', 'francois', 'jacques', 'philippe', 'marc', 'laurent', 'nicolas', 'antoine',
  'guillaume', 'christophe', 'thierry', 'alain', 'pascal', 'olivier', 'bruno', 'serge', 'rene', 'yves',
  'benoit', 'julien', 'cedric', 'fabien', 'maxime', 'romain', 'quentin', 'hugo', 'louis', 'baptiste',
  // European - Spanish/Portuguese
  'carlos', 'jose', 'luis', 'miguel', 'antonio', 'francisco', 'pedro', 'manuel', 'rafael', 'jorge',
  'fernando', 'pablo', 'alejandro', 'javier', 'enrique', 'ricardo', 'andres', 'sergio', 'raul', 'alberto',
  'diego', 'ruben', 'ivan', 'alvaro', 'guillermo', 'mario', 'victor', 'eduardo', 'alfonso', 'ramon',
  'joao', 'bruno', 'tiago', 'andre', 'hugo', 'ricardo', 'nuno', 'rui', 'paulo', 'vitor',
  // European - Italian
  'marco', 'giuseppe', 'giovanni', 'luca', 'francesco', 'andrea', 'alessandro', 'matteo', 'davide', 'simone',
  'fabio', 'stefano', 'roberto', 'massimo', 'maurizio', 'claudio', 'daniele', 'paolo', 'riccardo', 'nicola',
  // European - Dutch/Scandinavian
  'jan', 'pieter', 'henk', 'willem', 'gerrit', 'jeroen', 'bas', 'joost', 'wouter', 'maarten',
  'erik', 'magnus', 'anders', 'johan', 'olof', 'soren', 'morten', 'bjorn', 'thor', 'leif',
  // European - Polish/Eastern European
  'piotr', 'pawel', 'tomasz', 'krzysztof', 'marcin', 'michal', 'jakub', 'maciej', 'adam', 'lukasz',
  'andrzej', 'wojciech', 'grzegorz', 'rafal', 'mariusz', 'dariusz', 'artur', 'kamil', 'mateusz', 'bartosz',
  'ivan', 'dmitri', 'sergei', 'mikhail', 'alexei', 'vladimir', 'boris', 'oleg', 'yuri', 'viktor',
  // African
  'kwame', 'kofi', 'ade', 'chidi', 'emeka', 'obinna', 'chibuzo', 'oluwole', 'babatunde', 'olumide',
  'segun', 'tunde', 'femi', 'tobi', 'yemi', 'bola', 'kunle', 'wale', 'dele', 'jide',
  'thabo', 'sipho', 'themba', 'mandla', 'bongani', 'sibusiso', 'sifiso', 'mthunzi', 'nkosinathi', 'kagiso',
  // Hebrew/Israeli
  'david', 'yosef', 'moshe', 'yakov', 'avraham', 'shlomo', 'itzhak', 'avi', 'eitan', 'alon',
  'roi', 'guy', 'oren', 'tal', 'nadav', 'yuval', 'nir', 'gal', 'amit', 'idan',
  // Turkish
  'mehmet', 'mustafa', 'ahmet', 'ali', 'hasan', 'huseyin', 'murat', 'ismail', 'osman', 'yusuf',
  'can', 'cem', 'emre', 'burak', 'baris', 'tolga', 'serkan', 'kerem', 'onur', 'arda'
]);

const femaleNames = new Set([
  // Western - English
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
  'allison', 'audrey', 'claire', 'stella', 'bella', 'lucy', 'anna', 'leah', 'savannah', 'brooklyn',
  'jill', 'wendy', 'kate', 'beth', 'anne', 'sue', 'kim', 'tina', 'gina', 'dana',
  'molly', 'holly', 'sally', 'tracy', 'stacy', 'carrie', 'terri', 'jenny', 'vicky', 'cindy',
  'bonnie', 'tammy', 'denise', 'renee', 'tiffany', 'brittany', 'crystal', 'brandy', 'amber', 'brooke',
  'fiona', 'sienna', 'willow', 'ivy', 'piper', 'jade', 'maya', 'daisy', 'violet', 'ruby',
  // Middle Eastern & Arabic
  'fatima', 'aisha', 'mariam', 'zahra', 'layla', 'noor', 'hana', 'yasmin', 'amira', 'sara',
  'leila', 'dina', 'mona', 'rania', 'dalal', 'huda', 'lubna', 'wafa', 'mai', 'dalia',
  'rana', 'reem', 'noura', 'abeer', 'asma', 'hadeel', 'manal', 'lina', 'yara', 'ghadeer',
  'maha', 'eman', 'heba', 'nesreen', 'sahar', 'sherine', 'ghada', 'samira', 'nawal', 'afaf',
  // South Asian - Indian, Pakistani, Bangladeshi
  'priya', 'anita', 'sunita', 'rekha', 'meena', 'deepa', 'kavita', 'neha', 'pooja', 'divya',
  'anjali', 'asha', 'geeta', 'indira', 'jaya', 'kamla', 'lata', 'mala', 'nandini', 'padma',
  'radha', 'rani', 'ritu', 'seema', 'shanti', 'shobha', 'sudha', 'uma', 'usha', 'vidya',
  'aditi', 'aishwarya', 'ananya', 'archana', 'bhavna', 'chitra', 'devika', 'dipti', 'garima', 'harini',
  'isha', 'jyoti', 'kritika', 'madhuri', 'manisha', 'megha', 'mitali', 'namita', 'nidhi', 'pallavi',
  'preeti', 'rashmi', 'ritu', 'sakshi', 'sangeeta', 'shruti', 'sneha', 'swati', 'tanvi', 'tanya',
  'ayesha', 'sana', 'zainab', 'farzana', 'nadia', 'shabnam', 'shazia', 'tahira', 'uzma', 'fatema',
  // East Asian - Chinese
  'yan', 'li', 'fang', 'xia', 'ying', 'mei', 'lan', 'min', 'na', 'hua',
  'jing', 'qian', 'ting', 'xue', 'yun', 'zhen', 'hong', 'chun', 'ling', 'rong',
  'juan', 'ping', 'yan', 'fen', 'qin', 'shu', 'xiao', 'yu', 'yi', 'lei',
  'lu', 'dan', 'ning', 'sha', 'yuan', 'lin', 'ai', 'bi', 'cui', 'fan',
  'shirveen', 'shirley', 'tina', 'lily', 'jenny', 'grace', 'emily', 'kelly', 'vivian', 'connie',
  'winnie', 'maggie', 'candy', 'ivy', 'cynthia', 'cindy', 'sunny', 'wendy', 'nancy', 'betty',
  // East Asian - Japanese
  'yuki', 'sakura', 'akiko', 'yoko', 'keiko', 'hiroko', 'michiko', 'naomi', 'mari', 'emi',
  'haruka', 'ayumi', 'yui', 'miki', 'rika', 'nana', 'sayaka', 'mayumi', 'tomoko', 'yukiko',
  'kazuko', 'kumiko', 'noriko', 'reiko', 'sachiko', 'satoko', 'shizuka', 'takako', 'yasuko', 'yumiko',
  'aiko', 'asuka', 'chiaki', 'chika', 'eri', 'honoka', 'kaori', 'kayo', 'mai', 'mao',
  'miho', 'misaki', 'momoko', 'nanami', 'rin', 'risa', 'saki', 'shiori', 'yuka', 'ayaka',
  // East Asian - Korean
  'minji', 'jiwon', 'soyeon', 'yuna', 'hyejin', 'eunbi', 'suji', 'haein', 'jiyeon', 'sujin',
  'mina', 'hana', 'yuna', 'sora', 'yerin', 'jihye', 'jiwoo', 'seohyun', 'eunji', 'hayoung',
  // European - German
  'anna', 'katrin', 'claudia', 'sabine', 'petra', 'stefanie', 'monika', 'nicole', 'sandra', 'julia',
  'sarah', 'lena', 'lisa', 'hannah', 'laura', 'marie', 'sophie', 'emma', 'mia', 'lea',
  'heike', 'ute', 'birgit', 'gabi', 'karin', 'ingrid', 'renate', 'ursula', 'elisabeth', 'eva',
  // European - French
  'marie', 'sophie', 'camille', 'claire', 'nathalie', 'sylvie', 'isabelle', 'anne', 'valerie', 'celine',
  'aurelie', 'emilie', 'pauline', 'manon', 'lea', 'chloe', 'julie', 'charlotte', 'margaux', 'clemence',
  'lucie', 'marine', 'mathilde', 'alice', 'jeanne', 'louise', 'juliette', 'helene', 'sandrine', 'delphine',
  // European - Spanish/Portuguese
  'carmen', 'lucia', 'rosa', 'elena', 'laura', 'isabel', 'ana', 'teresa', 'cristina', 'paula',
  'marta', 'patricia', 'beatriz', 'pilar', 'raquel', 'silvia', 'alicia', 'rocio', 'adriana', 'lorena',
  'maria', 'julia', 'clara', 'alba', 'andrea', 'ines', 'irene', 'natalia', 'sara', 'diana',
  'mariana', 'catarina', 'ines', 'rita', 'sofia', 'leonor', 'beatriz', 'joana', 'daniela', 'carolina',
  // European - Italian
  'giulia', 'francesca', 'valentina', 'chiara', 'elisa', 'sara', 'alessia', 'martina', 'federica', 'silvia',
  'paola', 'claudia', 'elena', 'roberta', 'anna', 'lucia', 'monica', 'simona', 'barbara', 'patrizia',
  // European - Dutch/Scandinavian
  'anna', 'maria', 'emma', 'lisa', 'eva', 'sanne', 'lotte', 'julia', 'sophie', 'fleur',
  'ingrid', 'astrid', 'karin', 'sigrid', 'birgit', 'annika', 'linnea', 'maja', 'frida', 'ebba',
  // European - Polish/Eastern European
  'anna', 'maria', 'katarzyna', 'malgorzata', 'agnieszka', 'barbara', 'krystyna', 'ewa', 'elzbieta', 'zofia',
  'aleksandra', 'joanna', 'dorota', 'monika', 'beata', 'iwona', 'karolina', 'natalia', 'justyna', 'sylwia',
  'olga', 'natasha', 'tatiana', 'irina', 'elena', 'svetlana', 'marina', 'yulia', 'ekaterina', 'anastasia',
  // African
  'adaeze', 'chioma', 'ngozi', 'nneka', 'obioma', 'chinwe', 'adanna', 'uju', 'amara', 'chiamaka',
  'abena', 'akua', 'ama', 'efua', 'yaa', 'adwoa', 'afua', 'akosua', 'adjoa', 'nana',
  'thandi', 'nomvula', 'zanele', 'lindiwe', 'palesa', 'lerato', 'dineo', 'mpho', 'thandiwe', 'sibongile',
  // Hebrew/Israeli
  'miriam', 'ruth', 'esther', 'leah', 'rivka', 'yael', 'tamar', 'noa', 'maya', 'shira',
  'michal', 'inbar', 'talia', 'dana', 'keren', 'hila', 'liora', 'orly', 'ayelet', 'galit',
  // Turkish
  'elif', 'zeynep', 'ayse', 'fatma', 'emine', 'hatice', 'merve', 'busra', 'selin', 'esra',
  'melis', 'derya', 'sibel', 'ceren', 'irem', 'gamze', 'tugba', 'ozge', 'ece', 'beren'
]);

function inferGenderFromName(fullName: string): { gender: 'male' | 'female' | 'unknown'; confidence: number } {
  const firstName = fullName.trim().split(/\s+/)[0].toLowerCase();
  
  // Direct match from name databases
  if (maleNames.has(firstName)) {
    return { gender: 'male', confidence: 0.9 };
  }
  if (femaleNames.has(firstName)) {
    return { gender: 'female', confidence: 0.9 };
  }
  
  // Try without accents/diacritics
  const normalizedName = firstName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalizedName !== firstName) {
    if (maleNames.has(normalizedName)) {
      return { gender: 'male', confidence: 0.85 };
    }
    if (femaleNames.has(normalizedName)) {
      return { gender: 'female', confidence: 0.85 };
    }
  }
  
  // Check name endings as heuristics (culturally common patterns)
  // Female endings
  if (firstName.endsWith('a') && !['joshua', 'ezra', 'luca', 'elia', 'nikita'].includes(firstName)) {
    return { gender: 'female', confidence: 0.65 };
  }
  if (firstName.endsWith('ie') || firstName.endsWith('y') && firstName.length > 3) {
    // Many nicknames end in -ie/-y for both genders, lower confidence
    return { gender: 'female', confidence: 0.5 };
  }
  if (firstName.endsWith('ine') || firstName.endsWith('elle') || firstName.endsWith('ette')) {
    return { gender: 'female', confidence: 0.75 };
  }
  if (firstName.endsWith('lyn') || firstName.endsWith('een') || firstName.endsWith('leen')) {
    return { gender: 'female', confidence: 0.7 };
  }
  
  // Male endings
  if (firstName.endsWith('o') && !['margo'].includes(firstName)) {
    return { gender: 'male', confidence: 0.6 };
  }
  if (firstName.endsWith('us') || firstName.endsWith('os')) {
    return { gender: 'male', confidence: 0.7 };
  }
  if (firstName.endsWith('er') || firstName.endsWith('or') || firstName.endsWith('ar')) {
    return { gender: 'male', confidence: 0.55 };
  }
  if (firstName.endsWith('ew') || firstName.endsWith('ck') || firstName.endsWith('ld')) {
    return { gender: 'male', confidence: 0.6 };
  }
  
  return { gender: 'unknown', confidence: 0 };
}

async function searchApolloByNameAndCompany(fullName: string, company: string, apiKey: string): Promise<ApolloPersonResponse | null> {
  try {
    console.log('Searching Apollo by name + company:', { fullName, company });
    
    // Apollo People Search API - finds people by name and organization
    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        q_person_name: fullName,
        q_organization_name: company,
        per_page: 1,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Apollo Search API error:', response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    console.log('Apollo Search response:', JSON.stringify(data, null, 2));
    
    // Return first matching person
    if (data.people && data.people.length > 0) {
      return { person: data.people[0] };
    }
    
    return null;
  } catch (error) {
    console.error('Error calling Apollo Search API:', error);
    return null;
  }
}

async function matchApolloByLinkedIn(linkedinUrl: string, apiKey: string): Promise<ApolloPersonResponse | null> {
  try {
    console.log('Matching Apollo by LinkedIn URL:', { linkedinUrl });
    
    // Apollo People Match API - matches by LinkedIn URL (most accurate, always current)
    const response = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        linkedin_url: linkedinUrl,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Apollo LinkedIn Match API error:', response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    console.log('Apollo LinkedIn Match response:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error calling Apollo LinkedIn Match API:', error);
    return null;
  }
}

async function matchApolloByEmail(email: string, fullName: string, apiKey: string): Promise<ApolloPersonResponse | null> {
  try {
    console.log('Matching Apollo by email:', { email, fullName });
    
    // Apollo People Match API - matches by email
    const response = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        email: email,
        name: fullName,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Apollo Match API error:', response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    console.log('Apollo Match response:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error calling Apollo Match API:', error);
    return null;
  }
}

async function enrichWithApollo(
  email: string, 
  fullName: string, 
  company: string | null, 
  linkedinUrl: string | null,
  apiKey: string
): Promise<ApolloPersonResponse | null> {
  // COMPLETE ENRICHMENT STRATEGY:
  // 1. Try LinkedIn URL match first - this gives us the CURRENT company (most reliable for job changes)
  // 2. ALWAYS do a secondary search with name + current company to get email + location from Apollo's database
  // 3. Merge the results: LinkedIn for job/company, Apollo search for email/location
  // 4. Fallback: name + provided company, then email match
  
  let currentCompany: string | null = company;
  let linkedInData: ApolloPersonResponse | null = null;
  let apolloSearchData: ApolloPersonResponse | null = null;
  
  // STEP 1: Try LinkedIn URL first (most reliable for finding CURRENT company)
  if (linkedinUrl) {
    console.log('STEP 1: Matching by LinkedIn URL to find current company...');
    linkedInData = await matchApolloByLinkedIn(linkedinUrl, apiKey);
    
    if (linkedInData?.person) {
      console.log('LinkedIn match found person');
      
      // Extract the CURRENT company from LinkedIn data
      if (linkedInData.person.organization?.name) {
        const linkedInCompany = linkedInData.person.organization.name;
        console.log('LinkedIn found current company:', linkedInCompany);
        
        // Update to use the NEW company from LinkedIn
        if (linkedInCompany !== company) {
          console.log('Company has CHANGED from:', company, 'to:', linkedInCompany);
        }
        currentCompany = linkedInCompany;
      }
    }
  }
  
  // STEP 2: ALWAYS search by name + current company to get email and location from Apollo's database
  // This is critical because LinkedIn match often doesn't have email, but Apollo's search does
  if (currentCompany) {
    console.log('STEP 2: Searching Apollo database by name + current company for email/location...');
    apolloSearchData = await searchApolloByNameAndCompany(fullName, currentCompany, apiKey);
    
    if (apolloSearchData?.person) {
      console.log('Apollo search found person with email:', apolloSearchData.person.email || 'NO EMAIL');
      console.log('Apollo search found location:', apolloSearchData.person.organization?.city, apolloSearchData.person.organization?.country);
    } else {
      console.log('Apollo search by name + company returned no results');
    }
  }
  
  // HELPER: Extract best email from Apollo person response
  // Apollo stores emails in multiple nested locations - we need to check all of them
  function extractBestEmail(person: ApolloPersonResponse['person']): { email?: string; email_status?: string } {
    if (!person) return {};
    
    // Priority 1: contact.email (MOST CURRENT - updated when person changes jobs)
    if (person.contact?.email) {
      console.log('Found email in contact object:', person.contact.email);
      return { email: person.contact.email, email_status: person.contact.email_status || undefined };
    }
    
    // Priority 2: contact_emails array (first/position=0 is most current)
    if (person.contact_emails && person.contact_emails.length > 0) {
      const primaryEmail = person.contact_emails.find(e => e.position === 0) || person.contact_emails[0];
      if (primaryEmail?.email) {
        console.log('Found email in contact_emails array:', primaryEmail.email);
        return { email: primaryEmail.email, email_status: primaryEmail.email_status || undefined };
      }
    }
    
    // Priority 3: person.email (may be stale/old job)
    if (person.email) {
      console.log('Using person.email (may be stale):', person.email);
      return { email: person.email, email_status: person.email_status || undefined };
    }
    
    return {};
  }
  
  // HELPER: Extract best location from Apollo person response
  // Apollo stores location in multiple places - person.contact is most accurate for individuals
  function extractBestLocation(person: ApolloPersonResponse['person']): { city?: string; country?: string } {
    if (!person) return {};
    
    // Priority 1: contact.city/country (MOST ACCURATE for individual's actual location)
    if (person.contact?.city || person.contact?.country) {
      console.log('Found location in contact object:', person.contact.city, person.contact.country);
      return { city: person.contact.city || undefined, country: person.contact.country || undefined };
    }
    
    // Priority 2: person.city/country (person-level location)
    if (person.city || person.country) {
      console.log('Found location at person level:', person.city, person.country);
      return { city: person.city || undefined, country: person.country || undefined };
    }
    
    // Priority 3: organization location (LEAST preferred - this is company HQ, not person's location!)
    // Only use as absolute last resort and with low confidence
    if (person.organization?.city || person.organization?.country) {
      console.log('Falling back to organization location (company HQ, not person):', person.organization.city, person.organization.country);
      return { city: person.organization.city || undefined, country: person.organization.country || undefined };
    }
    
    return {};
  }
  
  // STEP 3: Merge results - prioritize different sources for different data
  // LinkedIn: best for current job title and company (job changes)
  // But LinkedIn response ALSO has contact.email and contact.city/country that we need to extract!
  
  if (linkedInData?.person || apolloSearchData?.person) {
    const mergedResult: ApolloPersonResponse = { person: {} };
    const linkedIn = linkedInData?.person;
    const apolloSearch = apolloSearchData?.person;
    
    // Job title: prefer LinkedIn (most current for job changes)
    mergedResult.person!.title = linkedIn?.title || apolloSearch?.title;
    
    // Company/Organization: prefer LinkedIn (most current)
    mergedResult.person!.organization = linkedIn?.organization || apolloSearch?.organization;
    
    // LinkedIn URL: prefer LinkedIn source
    mergedResult.person!.linkedin_url = linkedIn?.linkedin_url || apolloSearch?.linkedin_url;
    
    // EMAIL: Extract from ALL nested locations, prioritizing LinkedIn contact object
    // The LinkedIn match response often has the email in contact.email even when person.email is null!
    const linkedInEmail = extractBestEmail(linkedIn);
    const apolloSearchEmail = extractBestEmail(apolloSearch);
    
    // Prefer LinkedIn contact email (most current), then Apollo search email
    if (linkedInEmail.email) {
      console.log('Using email from LinkedIn match (contact object):', linkedInEmail.email);
      mergedResult.person!.email = linkedInEmail.email;
      mergedResult.person!.email_status = linkedInEmail.email_status;
    } else if (apolloSearchEmail.email) {
      console.log('Using email from Apollo search:', apolloSearchEmail.email);
      mergedResult.person!.email = apolloSearchEmail.email;
      mergedResult.person!.email_status = apolloSearchEmail.email_status;
    }
    
    // LOCATION: Extract from contact objects (person's actual location, not company HQ)
    const linkedInLocation = extractBestLocation(linkedIn);
    const apolloSearchLocation = extractBestLocation(apolloSearch);
    
    // Prefer LinkedIn contact location (most current), then Apollo search location
    if (linkedInLocation.city || linkedInLocation.country) {
      console.log('Using location from LinkedIn match:', linkedInLocation.city, linkedInLocation.country);
      mergedResult.person!.city = linkedInLocation.city;
      mergedResult.person!.country = linkedInLocation.country;
    } else if (apolloSearchLocation.city || apolloSearchLocation.country) {
      console.log('Using location from Apollo search:', apolloSearchLocation.city, apolloSearchLocation.country);
      mergedResult.person!.city = apolloSearchLocation.city;
      mergedResult.person!.country = apolloSearchLocation.country;
    }
    
    // Industry data: prefer Apollo search (richer data)
    if (apolloSearch?.organization) {
      if (!mergedResult.person!.organization) {
        mergedResult.person!.organization = {};
      }
      mergedResult.person!.organization.industry = apolloSearch.organization.industry || mergedResult.person!.organization?.industry;
      mergedResult.person!.organization.primary_industry = apolloSearch.organization.primary_industry || mergedResult.person!.organization?.primary_industry;
      mergedResult.person!.organization.keywords = apolloSearch.organization.keywords || mergedResult.person!.organization?.keywords;
      mergedResult.person!.organization.sic_codes = apolloSearch.organization.sic_codes || mergedResult.person!.organization?.sic_codes;
      mergedResult.person!.organization.naics_codes = apolloSearch.organization.naics_codes || mergedResult.person!.organization?.naics_codes;
    }
    
    // Copy contact object and contact_emails from LinkedIn if available (for downstream extraction)
    if (linkedIn?.contact) {
      mergedResult.person!.contact = linkedIn.contact;
    }
    if (linkedIn?.contact_emails) {
      mergedResult.person!.contact_emails = linkedIn.contact_emails;
    }
    
    console.log('MERGED RESULT - email:', mergedResult.person!.email, 'location:', mergedResult.person!.city, mergedResult.person!.country, 'company:', mergedResult.person!.organization?.name);
    return mergedResult;
  }
  
  // STEP 4: Fallback - try name + original company if we haven't tried it
  if (company && company !== currentCompany) {
    console.log('STEP 4: Fallback - trying name + original company:', company);
    const fallbackResult = await searchApolloByNameAndCompany(fullName, company, apiKey);
    if (fallbackResult?.person) {
      console.log('Found person via fallback name + original company search');
      return fallbackResult;
    }
  }
  
  // STEP 5: Last resort - email match (may return stale data)
  console.log('STEP 5: Last resort - trying email match');
  const matchResult = await matchApolloByEmail(email, fullName, apiKey);
  if (matchResult?.person) {
    console.log('Found person via email match (may be stale)');
    return matchResult;
  }
  
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactId, fullName, email, linkedinUrl, company }: EnrichmentRequest = await req.json();
    
    console.log('Enriching contact:', { contactId, fullName, email, linkedinUrl, company });
    
    const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
    if (!apolloApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Apollo API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const result: EnrichmentResult = {
      confidence: {},
      sources: [],
    };
    
    // 1. Enrich with Apollo - prioritize LinkedIn URL, then name + company, then email
    const apolloData = await enrichWithApollo(email, fullName, company || null, linkedinUrl || null, apolloApiKey);
    
    if (apolloData?.person) {
      const person = apolloData.person;
      result.sources.push('apollo');
      
      // Job title
      if (person.title) {
        result.job_title = person.title;
      }
      
      // Location - Check all possible sources in priority order:
      // 1. contact.city/country (person's actual current location - MOST ACCURATE)
      // 2. person.city/country (person-level, set by merge step)
      // 3. organization location (company HQ - LEAST preferred, often wrong for remote workers)
      const contactCity = person.contact?.city;
      const contactCountry = person.contact?.country;
      const personCity = person.city;
      const personCountry = person.country;
      const orgCity = person.organization?.city;
      const orgCountry = person.organization?.country;
      
      // Priority 1: Contact-level location (most accurate for individual)
      if (contactCity || contactCountry) {
        result.city = contactCity || undefined;
        result.country = contactCountry || undefined;
        result.confidence.location = 0.95;
        console.log('Using contact location:', result.city, result.country);
      }
      // Priority 2: Person-level location 
      else if (personCity || personCountry) {
        result.city = personCity || undefined;
        result.country = personCountry || undefined;
        result.confidence.location = 0.9;
        console.log('Using person location:', result.city, result.country);
      }
      // Priority 3: Organization location (LAST RESORT - this is company HQ!)
      else if (orgCity || orgCountry) {
        result.city = orgCity || undefined;
        result.country = orgCountry || undefined;
        result.confidence.location = 0.4; // Very low confidence - company HQ != person's location
        console.log('WARNING: Falling back to org location (company HQ, may be wrong):', result.city, result.country);
      }
      
      // LinkedIn URL
      if (person.linkedin_url) {
        result.linkedin_url = person.linkedin_url;
      }
      
      // Company
      if (person.organization?.name) {
        result.company = person.organization.name;
      }
      
      // Sectors/Industry
      if (person.organization?.industry || person.organization?.primary_industry) {
        const industry = person.organization.primary_industry || person.organization.industry;
        if (industry) {
          result.sectors = [industry];
          result.confidence.sector = 0.85;
        }
      }
      
      // EMAIL EXTRACTION - Check all possible sources in priority order:
      // 1. contact.email (most current, updated when person changes jobs)
      // 2. contact_emails[0].email (array of emails, first is usually most current)
      // 3. person.email (can be stale/old job email but still useful)
      let bestEmail: string | undefined;
      let bestEmailStatus: string | undefined;
      
      // Priority 1: Check nested contact object (MOST CURRENT email)
      if (person.contact?.email) {
        bestEmail = person.contact.email;
        bestEmailStatus = person.contact.email_status || undefined;
        console.log('FINAL: Found email in contact object:', bestEmail);
      }
      
      // Priority 2: Check contact_emails array
      if (!bestEmail && person.contact_emails && person.contact_emails.length > 0) {
        const primaryContactEmail = person.contact_emails.find(e => e.position === 0) || person.contact_emails[0];
        if (primaryContactEmail?.email) {
          bestEmail = primaryContactEmail.email;
          bestEmailStatus = primaryContactEmail.email_status || undefined;
          console.log('FINAL: Found email in contact_emails array:', bestEmail);
        }
      }
      
      // Priority 3: Fall back to person.email (may be stale but still useful)
      if (!bestEmail && person.email) {
        bestEmail = person.email;
        bestEmailStatus = person.email_status || undefined;
        console.log('FINAL: Using person.email (may be stale):', bestEmail);
      }
      
      if (bestEmail) {
        result.email = bestEmail;
      }
      if (bestEmailStatus) {
        result.email_status = bestEmailStatus;
      }
      
      // SIC codes
      if (person.organization?.sic_codes && person.organization.sic_codes.length > 0) {
        result.sic_codes = person.organization.sic_codes;
      }
      
      // NAICS codes
      if (person.organization?.naics_codes && person.organization.naics_codes.length > 0) {
        result.naics_codes = person.organization.naics_codes;
      }
      
      // Company keywords
      if (person.organization?.keywords && person.organization.keywords.length > 0) {
        result.company_keywords = person.organization.keywords;
      }
    }
    
    // 2. Fallback: Infer gender from name (Apollo doesn't provide gender)
    const genderResult = inferGenderFromName(fullName);
    result.gender = genderResult.gender;
    result.confidence.gender = genderResult.confidence;
    if (!result.sources.includes('name_analysis')) {
      result.sources.push('name_analysis');
    }
    
    // 3. Fallback: Use provided company if Apollo didn't find one
    if (!result.company && company) {
      result.company = company;
    }
    
    // 4. Fallback: Use provided LinkedIn URL if Apollo didn't find one
    if (!result.linkedin_url && linkedinUrl) {
      result.linkedin_url = linkedinUrl;
    }
    
    console.log('Enrichment result:', result);
    
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Enrichment error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Enrichment failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
      state?: string;
      country?: string;
    };
    // Also check contact_emails array for the most current email
    contact_emails?: Array<{
      email?: string;
      email_status?: string;
      position?: number;
    }>;
    // Employment history can reveal current location and title
    employment_history?: Array<{
      current?: boolean;
      organization_name?: string;
      title?: string;
      raw_address?: string;
    }>;
  };
}

// Map of country names that might appear in company names
const countryPatterns: { [key: string]: string } = {
  'australia': 'Australia',
  'uk': 'United Kingdom',
  'usa': 'United States',
  'us': 'United States',
  'canada': 'Canada',
  'germany': 'Germany',
  'france': 'France',
  'japan': 'Japan',
  'china': 'China',
  'india': 'India',
  'singapore': 'Singapore',
  'hong kong': 'Hong Kong',
  'netherlands': 'Netherlands',
  'switzerland': 'Switzerland',
  'ireland': 'Ireland',
  'new zealand': 'New Zealand',
  'brazil': 'Brazil',
  'mexico': 'Mexico',
  'south africa': 'South Africa',
  'uae': 'United Arab Emirates',
  'dubai': 'United Arab Emirates',
};

// Cities that are well-known and imply their country
// Expanded list to catch more location data issues
const cityToCountry: { [key: string]: string } = {
  // United Kingdom - Major cities and towns
  'london': 'United Kingdom',
  'manchester': 'United Kingdom',
  'birmingham': 'United Kingdom',
  'leeds': 'United Kingdom',
  'liverpool': 'United Kingdom',
  'glasgow': 'United Kingdom',
  'edinburgh': 'United Kingdom',
  'bristol': 'United Kingdom',
  'sheffield': 'United Kingdom',
  'newcastle': 'United Kingdom',
  'newcastle upon tyne': 'United Kingdom',
  'nottingham': 'United Kingdom',
  'southampton': 'United Kingdom',
  'cardiff': 'United Kingdom',
  'belfast': 'United Kingdom',
  'leicester': 'United Kingdom',
  'coventry': 'United Kingdom',
  'reading': 'United Kingdom',
  'oxford': 'United Kingdom',
  'cambridge': 'United Kingdom',
  'brighton': 'United Kingdom',
  'hull': 'United Kingdom',
  'stoke': 'United Kingdom',
  'wolverhampton': 'United Kingdom',
  'derby': 'United Kingdom',
  'swansea': 'United Kingdom',
  'aberdeen': 'United Kingdom',
  'dundee': 'United Kingdom',
  'plymouth': 'United Kingdom',
  'luton': 'United Kingdom',
  'slough': 'United Kingdom',
  'norwich': 'United Kingdom',
  'bournemouth': 'United Kingdom',
  'portsmouth': 'United Kingdom',
  'swindon': 'United Kingdom',
  'warrington': 'United Kingdom',
  'york': 'United Kingdom',
  'peterborough': 'United Kingdom',
  'stockport': 'United Kingdom',
  'guildford': 'United Kingdom',
  'basildon': 'United Kingdom',
  'watford': 'United Kingdom',
  'croydon': 'United Kingdom',
  'bromley': 'United Kingdom',
  'ealing': 'United Kingdom',
  'enfield': 'United Kingdom',
  'barnet': 'United Kingdom',
  'wembley': 'United Kingdom',
  'richmond': 'United Kingdom',
  'kingston': 'United Kingdom',
  'wimbledon': 'United Kingdom',
  'greenwich': 'United Kingdom',
  'canary wharf': 'United Kingdom',
  'stratford': 'United Kingdom',
  // Australia
  'sydney': 'Australia',
  'melbourne': 'Australia',
  'brisbane': 'Australia',
  'perth': 'Australia',
  'adelaide': 'Australia',
  'canberra': 'Australia',
  'gold coast': 'Australia',
  'hobart': 'Australia',
  'darwin': 'Australia',
  // United States - Major cities
  'new york': 'United States',
  'new york city': 'United States',
  'los angeles': 'United States',
  'chicago': 'United States',
  'san francisco': 'United States',
  'houston': 'United States',
  'phoenix': 'United States',
  'philadelphia': 'United States',
  'san antonio': 'United States',
  'san diego': 'United States',
  'dallas': 'United States',
  'austin': 'United States',
  'boston': 'United States',
  'seattle': 'United States',
  'denver': 'United States',
  'atlanta': 'United States',
  'miami': 'United States',
  'washington': 'United States',
  'washington dc': 'United States',
  // Other countries
  'tokyo': 'Japan',
  'osaka': 'Japan',
  'kyoto': 'Japan',
  'paris': 'France',
  'lyon': 'France',
  'marseille': 'France',
  'berlin': 'Germany',
  'munich': 'Germany',
  'frankfurt': 'Germany',
  'hamburg': 'Germany',
  'toronto': 'Canada',
  'vancouver': 'Canada',
  'montreal': 'Canada',
  'calgary': 'Canada',
  'singapore': 'Singapore',
  'hong kong': 'Hong Kong',
  'dubai': 'United Arab Emirates',
  'abu dhabi': 'United Arab Emirates',
  'mumbai': 'India',
  'bangalore': 'India',
  'bengaluru': 'India',
  'delhi': 'India',
  'new delhi': 'India',
  'hyderabad': 'India',
  'chennai': 'India',
  'pune': 'India',
  'shanghai': 'China',
  'beijing': 'China',
  'shenzhen': 'China',
  'guangzhou': 'China',
  'amsterdam': 'Netherlands',
  'rotterdam': 'Netherlands',
  'zurich': 'Switzerland',
  'geneva': 'Switzerland',
  'dublin': 'Ireland',
  'auckland': 'New Zealand',
  'wellington': 'New Zealand',
  'sao paulo': 'Brazil',
  'rio de janeiro': 'Brazil',
  'mexico city': 'Mexico',
  'johannesburg': 'South Africa',
  'cape town': 'South Africa',
  'stockholm': 'Sweden',
  'oslo': 'Norway',
  'copenhagen': 'Denmark',
  'helsinki': 'Finland',
  'brussels': 'Belgium',
  'vienna': 'Austria',
  'warsaw': 'Poland',
  'prague': 'Czech Republic',
  'madrid': 'Spain',
  'barcelona': 'Spain',
  'lisbon': 'Portugal',
  'rome': 'Italy',
  'milan': 'Italy',
  'seoul': 'South Korea',
  'taipei': 'Taiwan',
  'bangkok': 'Thailand',
  'kuala lumpur': 'Malaysia',
  'jakarta': 'Indonesia',
  'manila': 'Philippines',
  'ho chi minh city': 'Vietnam',
  'hanoi': 'Vietnam',
};

// Extract country from company name (e.g., "KPMG Australia" -> "Australia")
function extractCountryFromCompanyName(companyName: string | undefined): string | undefined {
  if (!companyName) return undefined;
  
  const lowerName = companyName.toLowerCase();
  
  for (const [pattern, country] of Object.entries(countryPatterns)) {
    // Check if company name ends with or contains the country
    if (lowerName.includes(pattern)) {
      console.log(`Inferred country "${country}" from company name "${companyName}"`);
      return country;
    }
  }
  
  return undefined;
}

// Infer country from city name
function inferCountryFromCity(city: string | undefined): string | undefined {
  if (!city) return undefined;
  
  const lowerCity = city.toLowerCase();
  const country = cityToCountry[lowerCity];
  
  if (country) {
    console.log(`Inferred country "${country}" from city "${city}"`);
  }
  
  return country;
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

// Helper to check if an email is a placeholder/invalid email that should be ignored
function isPlaceholderEmail(email: string | undefined | null): boolean {
  if (!email) return true;
  
  const lowerEmail = email.toLowerCase().trim();
  
  // Common placeholder patterns
  const placeholderPatterns = [
    /^unknown\d*@/,           // unknown@, unknown1@, unknown123@
    /^placeholder@/,
    /^noemail@/,
    /^none@/,
    /^na@/,
    /^test@/,
    /^fake@/,
    /^dummy@/,
    /@example\./,             // anything@example.com
    /@unknown\./,             // anything@unknown.com
    /@placeholder\./,
    /@noreply\./,
  ];
  
  for (const pattern of placeholderPatterns) {
    if (pattern.test(lowerEmail)) {
      console.log(`Detected placeholder email: "${email}"`);
      return true;
    }
  }
  
  return false;
}

// Helper to get a valid email (returns undefined if placeholder)
function getValidEmail(email: string | undefined | null): string | undefined {
  if (isPlaceholderEmail(email)) {
    return undefined;
  }
  return email || undefined;
}

// Helper function to check if two names match (fuzzy matching)
function namesMatch(searchName: string, foundName: string): boolean {
  if (!searchName || !foundName) return false;
  
  // Normalize both names: lowercase, remove extra spaces, handle comma format
  const normalize = (name: string): string[] => {
    let normalized = name.toLowerCase().trim();
    
    // Handle "Surname, FirstName" format
    if (normalized.includes(',')) {
      const parts = normalized.split(',').map(p => p.trim());
      normalized = `${parts[1]} ${parts[0]}`;
    }
    
    // Split into individual name parts
    return normalized.split(/\s+/).filter(p => p.length > 0);
  };
  
  const searchParts = normalize(searchName);
  const foundParts = normalize(foundName);
  
  // Check if first name matches (at least first 3 chars for nicknames like "Bob" vs "Robert")
  const searchFirst = searchParts[0] || '';
  const foundFirst = foundParts[0] || '';
  
  const firstNameMatch = searchFirst === foundFirst || 
    searchFirst.startsWith(foundFirst.substring(0, 3)) ||
    foundFirst.startsWith(searchFirst.substring(0, 3));
  
  // Check if last name matches
  const searchLast = searchParts[searchParts.length - 1] || '';
  const foundLast = foundParts[foundParts.length - 1] || '';
  
  const lastNameMatch = searchLast === foundLast;
  
  console.log('Name matching:', { 
    searchName, foundName, 
    searchFirst, foundFirst, firstNameMatch,
    searchLast, foundLast, lastNameMatch,
    match: firstNameMatch && lastNameMatch
  });
  
  return firstNameMatch && lastNameMatch;
}

async function searchApolloByNameAndCompany(fullName: string, company: string, apiKey: string): Promise<ApolloPersonResponse | null> {
  try {
    console.log('Searching Apollo by name + company:', { fullName, company });
    
    // Parse the name - handle both "FirstName Surname" and "Surname, FirstName" formats
    let firstName = '';
    let lastName = '';
    
    if (fullName.includes(',')) {
      // "Surname, FirstName" format
      const parts = fullName.split(',').map(p => p.trim());
      lastName = parts[0] || '';
      firstName = parts[1] || '';
    } else {
      // "FirstName Surname" format
      const parts = fullName.trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
    
    console.log('Parsed name:', { firstName, lastName, originalName: fullName });
    
    // Apollo People API Search - NEW endpoint
    // Docs: https://docs.apollo.io/reference/people-api-search
    const response = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        q_organization_name: company,
        person_first_name: firstName,
        person_last_name: lastName,
        per_page: 10, // Get more results to find the right person
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Apollo Search API error:', response.status, errorText);
      
      // If the new endpoint fails, try the People Match API as fallback
      console.log('Trying People Match API as fallback...');
      return await matchApolloByNameAndCompany(fullName, company, apiKey);
    }
    
    const data = await response.json();
    console.log('Apollo Search response - found', data.people?.length || 0, 'people');
    
    // CRITICAL: Find the person whose name actually matches what we're looking for
    if (data.people && data.people.length > 0) {
      // Try to find exact or close match
      const matchingPerson = data.people.find((p: any) => {
        const apolloFullName = p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
        return namesMatch(fullName, apolloFullName);
      });
      
      if (!matchingPerson) {
        console.log('Apollo search returned people but none matched the name:', fullName);
        console.log('Names returned:', data.people.map((p: any) => p.name || `${p.first_name} ${p.last_name}`));
        // Fall back to People Match API which is more precise
        return await matchApolloByNameAndCompany(fullName, company, apiKey);
      }
      
      console.log('Found matching person:', matchingPerson.name || `${matchingPerson.first_name} ${matchingPerson.last_name}`);
      
      // If the search returned a placeholder email but we have a person ID, 
      // try to enrich to get the real email
      if (matchingPerson.id && isPlaceholderEmail(matchingPerson.email)) {
        console.log('Search returned placeholder email, trying People Enrich with ID:', matchingPerson.id);
        const enrichedPerson = await enrichApolloPersonById(matchingPerson.id, apiKey);
        if (enrichedPerson?.person) {
          // Merge the enriched data with search data
          return { 
            person: { 
              ...matchingPerson, 
              ...enrichedPerson.person,
              // Keep organization data from search if enrichment doesn't have it
              organization: enrichedPerson.person.organization || matchingPerson.organization
            } 
          };
        }
      }
      
      return { person: matchingPerson };
    }
    
    console.log('Apollo search by name + company returned no results');
    return null;
  } catch (error) {
    console.error('Error calling Apollo Search API:', error);
    return null;
  }
}

// Fallback: Use People Match API with name and company domain
async function matchApolloByNameAndCompany(fullName: string, company: string, apiKey: string): Promise<ApolloPersonResponse | null> {
  try {
    console.log('Trying People Match API with name + company:', { fullName, company });
    
    const response = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        name: fullName,
        organization_name: company,
        reveal_personal_emails: false,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Apollo People Match API error:', response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    console.log('Apollo People Match response:', JSON.stringify(data, null, 2));
    
    // If match found and has placeholder email, try to enrich
    if (data?.person?.id && isPlaceholderEmail(data.person.email)) {
      console.log('People Match returned placeholder email, trying enrich with ID:', data.person.id);
      const enrichedData = await enrichApolloPersonById(data.person.id, apiKey);
      if (enrichedData?.person) {
        return { 
          person: { 
            ...data.person, 
            ...enrichedData.person,
            organization: data.person.organization || enrichedData.person.organization
          } 
        };
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error calling Apollo People Match API:', error);
    return null;
  }
}

// Apollo People Enrich endpoint - gets full data including revealed emails
async function enrichApolloPersonById(personId: string, apiKey: string): Promise<ApolloPersonResponse | null> {
  try {
    console.log('Enriching Apollo person by ID:', personId);
    
    // Apollo People Enrich API - gets full person data including revealed emails
    const response = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        id: personId,
        reveal_personal_emails: true,
        reveal_phone_number: false,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Apollo Enrich API error:', response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    console.log('Apollo Enrich by ID response:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error calling Apollo Enrich API:', error);
    return null;
  }
}

// Apollo Organization Enrich - gets full company data including NAICS/SIC codes
interface ApolloOrganization {
  id?: string;
  name?: string;
  industry?: string;
  primary_industry?: string;
  keywords?: string[];
  sic_codes?: string[];
  naics_codes?: string[];
  city?: string;
  country?: string;
  linkedin_url?: string;
  website_url?: string;
  estimated_num_employees?: number;
}

// Helper to guess domain from company name
function guessDomainFromCompany(companyName: string): string {
  // Clean up company name: lowercase, remove common suffixes, replace spaces with nothing
  let domain = companyName.toLowerCase().trim();
  
  // Remove common company suffixes
  const suffixes = [
    ' inc', ' inc.', ' llc', ' ltd', ' limited', ' corp', ' corporation', 
    ' co', ' co.', ' company', ' group', ' holding', ' holdings', 
    ' gmbh', ' ag', ' sa', ' nv', ' plc', ' pvt', ' private'
  ];
  for (const suffix of suffixes) {
    if (domain.endsWith(suffix)) {
      domain = domain.slice(0, -suffix.length);
    }
  }
  
  // Remove special characters and spaces
  domain = domain.replace(/[^a-z0-9]/g, '');
  
  // Add .com
  return domain + '.com';
}

async function enrichApolloOrganization(companyName: string, emailDomain?: string, apiKey?: string): Promise<ApolloOrganization | null> {
  if (!apiKey) return null;
  
  try {
    // Try to get domain from email first, otherwise guess from company name
    let domain = emailDomain;
    if (!domain) {
      domain = guessDomainFromCompany(companyName);
    }
    console.log('Enriching organization with domain:', domain, '(from company:', companyName, ')');
    
    // Apollo Organization Enrich API - requires domain parameter
    const response = await fetch('https://api.apollo.io/v1/organizations/enrich', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        domain: domain,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Apollo Organization Enrich API error:', response.status, errorText);
      
      // If domain guess failed, try without the guessed domain
      if (!emailDomain && domain) {
        console.log('Domain guess failed, organization enrich unavailable');
      }
      return null;
    }
    
    const data = await response.json();
    console.log('Apollo Organization Enrich response:', JSON.stringify(data?.organization || data, null, 2).slice(0, 1500));
    
    return data?.organization || null;
  } catch (error) {
    console.error('Error calling Apollo Organization Enrich API:', error);
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
    
    // If LinkedIn match returned a placeholder email but we have a person ID, 
    // try to enrich to get the real email
    if (data?.person?.id && isPlaceholderEmail(data.person.email)) {
      console.log('LinkedIn match returned placeholder email, trying People Enrich with ID:', data.person.id);
      const enrichedData = await enrichApolloPersonById(data.person.id, apiKey);
      if (enrichedData?.person) {
        // Merge the enriched data - keep LinkedIn data for org/title, use enriched for email
        return { 
          person: { 
            ...data.person, 
            ...enrichedData.person,
            // Keep original organization from LinkedIn (more accurate for current job)
            organization: data.person.organization || enrichedData.person.organization
          } 
        };
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error calling Apollo LinkedIn Match API:', error);
    return null;
  }
}

async function matchApolloByEmail(email: string, fullName: string, apiKey: string): Promise<ApolloPersonResponse | null> {
  // CRITICAL: Skip email match if the input email is a placeholder
  // This prevents us from searching Apollo with invalid/fake emails
  if (isPlaceholderEmail(email)) {
    console.log('Skipping email match - input email is placeholder:', email);
    return null;
  }
  
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
  // CRITICAL: Filter out placeholder emails like unknown1@unknown.com
  function extractBestEmail(person: ApolloPersonResponse['person']): { email?: string; email_status?: string } {
    if (!person) return {};
    
    // Priority 1: contact.email (MOST CURRENT - updated when person changes jobs)
    if (person.contact?.email) {
      const validEmail = getValidEmail(person.contact.email);
      if (validEmail) {
        console.log('Found VALID email in contact object:', validEmail);
        return { email: validEmail, email_status: person.contact.email_status || undefined };
      } else {
        console.log('Contact email is placeholder, skipping:', person.contact.email);
      }
    }
    
    // Priority 2: contact_emails array (first/position=0 is most current)
    if (person.contact_emails && person.contact_emails.length > 0) {
      // Try to find a valid email in the array
      for (const contactEmail of person.contact_emails) {
        const validEmail = getValidEmail(contactEmail?.email);
        if (validEmail) {
          console.log('Found VALID email in contact_emails array:', validEmail);
          return { email: validEmail, email_status: contactEmail.email_status || undefined };
        }
      }
      console.log('All contact_emails are placeholders, skipping');
    }
    
    // Priority 3: person.email (may be stale/old job)
    if (person.email) {
      const validEmail = getValidEmail(person.email);
      if (validEmail) {
        console.log('Using VALID person.email:', validEmail);
        return { email: validEmail, email_status: person.email_status || undefined };
      } else {
        console.log('Person email is placeholder, skipping:', person.email);
      }
    }
    
    console.log('No valid email found in Apollo response');
    return {};
  }
  
  // HELPER: Extract best location from Apollo person response
  // CRITICAL: LinkedIn data should NEVER fall back to organization HQ - that's where the company is, not the person
  // Apollo search may have person-level location that's more accurate
  function extractBestLocation(person: ApolloPersonResponse['person'], isLinkedInSource: boolean = false): { city?: string; country?: string; fromOrg?: boolean } {
    if (!person) return {};
    
    let city: string | undefined;
    let country: string | undefined;
    let fromOrg = false;
    
    // Priority 1: contact.city/country (MOST ACCURATE for individual's actual location)
    if (person.contact?.city || person.contact?.country) {
      console.log('Found location in contact object:', person.contact.city, person.contact.country);
      city = person.contact.city || undefined;
      country = person.contact.country || undefined;
    }
    // Priority 2: person.city/country (person-level location)
    else if (person.city || person.country) {
      console.log('Found location at person level:', person.city, person.country);
      city = person.city || undefined;
      country = person.country || undefined;
    }
    // Priority 3: organization location - ONLY use for Apollo search, NEVER for LinkedIn
    // LinkedIn should tell us where the person IS, not where the company HQ is
    else if (!isLinkedInSource && (person.organization?.city || person.organization?.country)) {
      console.log('Falling back to organization location (company HQ - ONLY because this is Apollo search, not LinkedIn):', person.organization.city, person.organization.country);
      city = person.organization.city || undefined;
      country = person.organization.country || undefined;
      fromOrg = true; // Mark this as org-sourced so we can deprioritize it
    }
    
    // SMART FIX: If we have a city, infer the correct country from it
    // This fixes cases like "Sydney" being paired with "United Kingdom"
    if (city) {
      const inferredCountry = inferCountryFromCity(city);
      if (inferredCountry) {
        // If inferred country differs from Apollo's country, trust the city-based inference
        if (country && inferredCountry !== country) {
          console.log(`CORRECTING country: "${country}" -> "${inferredCountry}" based on city "${city}"`);
        }
        country = inferredCountry;
      }
    }
    
    // SMART FIX: If we still don't have a country, try to infer from company name
    // But only do this if we're not using LinkedIn (where we expect person-level data)
    if (!country && !isLinkedInSource && person.organization?.name) {
      const companyCountry = extractCountryFromCompanyName(person.organization.name);
      if (companyCountry) {
        country = companyCountry;
        fromOrg = true;
      }
    }
    
    return { city, country, fromOrg };
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
    
    // LOCATION: LinkedIn is authoritative for where the person actually lives
    // Apollo search may have org-level location which is just company HQ - we should NOT use that
    // Pass isLinkedInSource=true so LinkedIn data never falls back to org location
    const linkedInLocation = extractBestLocation(linkedIn, true); // true = is LinkedIn source, never use org fallback
    const apolloSearchLocation = extractBestLocation(apolloSearch, false); // false = Apollo search, can use org as last resort
    
    // SMART MERGE: LinkedIn location is authoritative (where person actually is)
    // Only use Apollo search location if:
    // 1. LinkedIn has no location data, AND
    // 2. Apollo search location is NOT from organization (company HQ)
    if (linkedInLocation.city || linkedInLocation.country) {
      console.log('Using location from LinkedIn match (AUTHORITATIVE for person location):', linkedInLocation.city, linkedInLocation.country);
      mergedResult.person!.city = linkedInLocation.city;
      mergedResult.person!.country = linkedInLocation.country;
    } else if ((apolloSearchLocation.city || apolloSearchLocation.country) && !apolloSearchLocation.fromOrg) {
      // Apollo search has person-level location (not from org)
      console.log('Using person-level location from Apollo search:', apolloSearchLocation.city, apolloSearchLocation.country);
      mergedResult.person!.city = apolloSearchLocation.city;
      mergedResult.person!.country = apolloSearchLocation.country;
    } else if (apolloSearchLocation.fromOrg) {
      // Apollo only has org-level location - log warning but still use as last resort
      console.log('WARNING: Only org-level location available from Apollo (company HQ, may be wrong):', apolloSearchLocation.city, apolloSearchLocation.country);
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
      // THEN: Apply city-to-country inference to catch data inconsistencies
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
      
      // SMART FIX: Apply city-to-country inference to catch inconsistencies like "Sydney, United Kingdom"
      if (result.city) {
        const inferredCountry = inferCountryFromCity(result.city);
        if (inferredCountry) {
          if (result.country && inferredCountry !== result.country) {
            console.log(`CORRECTING country in final result: "${result.country}" -> "${inferredCountry}" based on city "${result.city}"`);
          }
          result.country = inferredCountry;
          result.confidence.location = 0.95; // High confidence when we can infer from city
        }
      }
      
      // SMART FIX: If still no country, try to infer from company name
      if (!result.country && person.organization?.name) {
        const companyCountry = extractCountryFromCompanyName(person.organization.name);
        if (companyCountry) {
          result.country = companyCountry;
          result.confidence.location = 0.7; // Medium confidence from company name
        }
      }
      
      // LinkedIn URL
      if (person.linkedin_url) {
        result.linkedin_url = person.linkedin_url;
      }
      
      // Company - check organization.name first, then fall back to employment_history
      if (person.organization?.name) {
        result.company = person.organization.name;
      } else if (person.employment_history && person.employment_history.length > 0) {
        // Find the current job from employment history
        const currentJob = person.employment_history.find(job => job.current) || person.employment_history[0];
        if (currentJob?.organization_name) {
          result.company = currentJob.organization_name;
          console.log('Extracted company from employment_history:', result.company);
        }
      }
      
      // Job title - also check employment_history as fallback
      if (!result.job_title && person.employment_history && person.employment_history.length > 0) {
        const currentJob = person.employment_history.find((job: { current?: boolean; title?: string }) => job.current) || person.employment_history[0];
        if ((currentJob as { title?: string })?.title) {
          result.job_title = (currentJob as { title?: string }).title;
          console.log('Extracted job_title from employment_history:', result.job_title);
        }
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
      // CRITICAL: Filter out placeholder emails like unknown1@unknown.com
      let bestEmail: string | undefined;
      let bestEmailStatus: string | undefined;
      
      // Priority 1: Check nested contact object (MOST CURRENT email)
      if (person.contact?.email) {
        const validEmail = getValidEmail(person.contact.email);
        if (validEmail) {
          bestEmail = validEmail;
          bestEmailStatus = person.contact.email_status || undefined;
          console.log('FINAL: Found VALID email in contact object:', bestEmail);
        } else {
          console.log('FINAL: Contact email is placeholder, skipping:', person.contact.email);
        }
      }
      
      // Priority 2: Check contact_emails array
      if (!bestEmail && person.contact_emails && person.contact_emails.length > 0) {
        for (const contactEmail of person.contact_emails) {
          const validEmail = getValidEmail(contactEmail?.email);
          if (validEmail) {
            bestEmail = validEmail;
            bestEmailStatus = contactEmail.email_status || undefined;
            console.log('FINAL: Found VALID email in contact_emails array:', bestEmail);
            break;
          }
        }
        if (!bestEmail) {
          console.log('FINAL: All contact_emails are placeholders, skipping');
        }
      }
      
      // Priority 3: Fall back to person.email (may be stale but still useful)
      if (!bestEmail && person.email) {
        const validEmail = getValidEmail(person.email);
        if (validEmail) {
          bestEmail = validEmail;
          bestEmailStatus = person.email_status || undefined;
          console.log('FINAL: Using VALID person.email:', bestEmail);
        } else {
          console.log('FINAL: Person email is placeholder, skipping:', person.email);
        }
      }
      
      if (bestEmail) {
        result.email = bestEmail;
      } else {
        console.log('FINAL: No valid email found - Apollo only returned placeholder emails');
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
    
    // STEP 6: If we still don't have NAICS/SIC codes but we have a company name,
    // call Organization Enrich API to get industry data
    const companyNameToEnrich = result.company || company;
    const hasIndustryCodes = (result.naics_codes && result.naics_codes.length > 0) || 
                             (result.sic_codes && result.sic_codes.length > 0);
    
    if (!hasIndustryCodes && companyNameToEnrich) {
      console.log('STEP 6: Missing industry codes - enriching organization:', companyNameToEnrich);
      // Extract domain from email for more accurate organization lookup
      const emailDomain = email ? email.split('@')[1] : undefined;
      const orgData = await enrichApolloOrganization(companyNameToEnrich, emailDomain, apolloApiKey);
      
      if (orgData) {
        result.sources.push('apollo_org');
        
        // NAICS codes from organization
        if (orgData.naics_codes && orgData.naics_codes.length > 0) {
          result.naics_codes = orgData.naics_codes;
          console.log('Got NAICS codes from org enrich:', result.naics_codes);
        }
        
        // SIC codes from organization
        if (orgData.sic_codes && orgData.sic_codes.length > 0) {
          result.sic_codes = orgData.sic_codes;
          console.log('Got SIC codes from org enrich:', result.sic_codes);
        }
        
        // Industry/sector from organization
        if (!result.sectors || result.sectors.length === 0) {
          const industry = orgData.primary_industry || orgData.industry;
          if (industry) {
            result.sectors = [industry];
            result.confidence.sector = 0.8;
            console.log('Got sector from org enrich:', industry);
          }
        }
        
        // Company keywords from organization
        if ((!result.company_keywords || result.company_keywords.length === 0) && 
            orgData.keywords && orgData.keywords.length > 0) {
          result.company_keywords = orgData.keywords;
          console.log('Got keywords from org enrich:', result.company_keywords.slice(0, 5));
        }
        
        // Location from organization as last resort
        if (!result.country && orgData.country) {
          result.country = orgData.country;
          result.confidence.location = 0.3; // Very low - this is company HQ
          console.log('Got country from org enrich (HQ location):', result.country);
        }
      } else {
        console.log('Organization enrich returned no data for:', companyNameToEnrich);
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

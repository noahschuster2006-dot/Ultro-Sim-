import type { Culture } from './countries';

interface NamePool {
  male: string[];
  female: string[];
  last: string[];
}

export const NAMES: Record<Culture, NamePool> = {
  anglo: {
    male: ['James', 'John', 'William', 'Henry', 'Thomas', 'George', 'Edward', 'Charles', 'Samuel', 'Arthur', 'Oliver', 'Jack', 'Michael', 'David', 'Daniel', 'Robert', 'Liam', 'Noah', 'Ethan', 'Harry'],
    female: ['Mary', 'Elizabeth', 'Anne', 'Margaret', 'Sarah', 'Emily', 'Charlotte', 'Alice', 'Grace', 'Rose', 'Emma', 'Olivia', 'Sophie', 'Hannah', 'Jessica', 'Lucy', 'Ava', 'Amelia', 'Isla', 'Ruby'],
    last: ['Smith', 'Johnson', 'Brown', 'Taylor', 'Wilson', 'Clarke', 'Wright', 'Walker', 'Hughes', 'Turner', 'Harrington', 'Blackwood', 'Ashford', 'Whitlock', 'Mercer', 'Hale', 'Thorne', 'Lockwood', 'Carver', 'Sterling'],
  },
  french: {
    male: ['Jean', 'Pierre', 'Louis', 'Jacques', 'Henri', 'Antoine', 'Philippe', 'Étienne', 'Luc', 'Hugo', 'Mathis', 'Théo', 'Gabriel', 'Julien', 'Rémi'],
    female: ['Marie', 'Jeanne', 'Camille', 'Élise', 'Louise', 'Margaux', 'Chloé', 'Manon', 'Inès', 'Juliette', 'Amélie', 'Céline', 'Hélène', 'Léa', 'Clémence'],
    last: ['Martin', 'Bernard', 'Dubois', 'Moreau', 'Laurent', 'Lefèvre', 'Fontaine', 'Rousseau', 'Delacroix', 'Girard', 'Marchand', 'Beaumont', 'Chevalier', 'Duval', 'Lambert'],
  },
  german: {
    male: ['Johann', 'Friedrich', 'Karl', 'Heinrich', 'Wilhelm', 'Otto', 'Hans', 'Klaus', 'Lukas', 'Felix', 'Maximilian', 'Jonas', 'Leon', 'Matthias', 'Dieter'],
    female: ['Anna', 'Maria', 'Greta', 'Liesel', 'Ursula', 'Hanna', 'Sophie', 'Clara', 'Lena', 'Mia', 'Johanna', 'Katharina', 'Frieda', 'Ingrid', 'Emilia'],
    last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Hoffmann', 'Richter', 'Krause', 'Vogel', 'Brandt', 'Keller', 'Albrecht', 'Lindner'],
  },
  italian: {
    male: ['Giovanni', 'Giuseppe', 'Marco', 'Luca', 'Antonio', 'Francesco', 'Lorenzo', 'Matteo', 'Alessandro', 'Salvatore', 'Vincenzo', 'Paolo', 'Enzo', 'Dario', 'Riccardo'],
    female: ['Maria', 'Giulia', 'Francesca', 'Sofia', 'Chiara', 'Alessia', 'Lucia', 'Valentina', 'Elena', 'Bianca', 'Rosa', 'Caterina', 'Beatrice', 'Serena', 'Aurora'],
    last: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Moretti'],
  },
  latin: {
    male: ['Marcus', 'Gaius', 'Lucius', 'Quintus', 'Titus', 'Publius', 'Gnaeus', 'Decimus', 'Aulus', 'Servius', 'Tiberius', 'Sextus'],
    female: ['Julia', 'Livia', 'Cornelia', 'Claudia', 'Valeria', 'Aurelia', 'Octavia', 'Tullia', 'Flavia', 'Antonia', 'Drusilla', 'Fabia'],
    last: ['Cornelius', 'Julius', 'Claudius', 'Valerius', 'Aurelius', 'Fabius', 'Flavius', 'Licinius', 'Junius', 'Tullius', 'Sempronius', 'Aemilius'],
  },
  spanish: {
    male: ['José', 'Juan', 'Carlos', 'Miguel', 'Diego', 'Alejandro', 'Javier', 'Pablo', 'Fernando', 'Rafael', 'Santiago', 'Mateo', 'Andrés', 'Luis', 'Emilio'],
    female: ['María', 'Carmen', 'Lucía', 'Isabel', 'Sofía', 'Valentina', 'Elena', 'Paula', 'Camila', 'Ana', 'Martina', 'Daniela', 'Rosa', 'Inés', 'Gabriela'],
    last: ['García', 'Rodríguez', 'Martínez', 'López', 'Hernández', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Vargas', 'Castillo', 'Navarro', 'Ortega', 'Mendoza'],
  },
  portuguese: {
    male: ['João', 'Pedro', 'Lucas', 'Gabriel', 'Rafael', 'Mateus', 'Thiago', 'Bruno', 'Felipe', 'Rodrigo', 'Caio', 'Gustavo'],
    female: ['Ana', 'Maria', 'Beatriz', 'Júlia', 'Larissa', 'Camila', 'Fernanda', 'Mariana', 'Letícia', 'Isabela', 'Gabriela', 'Clara'],
    last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Pereira', 'Almeida', 'Ferreira', 'Carvalho', 'Ribeiro', 'Gomes', 'Barbosa'],
  },
  slavic: {
    male: ['Ivan', 'Dmitri', 'Alexei', 'Sergei', 'Nikolai', 'Mikhail', 'Vladimir', 'Yuri', 'Boris', 'Pavel', 'Andrei', 'Oleg', 'Artem', 'Konstantin'],
    female: ['Anastasia', 'Natalia', 'Olga', 'Tatiana', 'Svetlana', 'Irina', 'Ekaterina', 'Yelena', 'Darya', 'Sofia', 'Polina', 'Vera', 'Ksenia', 'Marina'],
    last: ['Ivanov', 'Petrov', 'Smirnov', 'Volkov', 'Sokolov', 'Popov', 'Morozov', 'Kuznetsov', 'Orlov', 'Lebedev', 'Kozlov', 'Novikov', 'Fedorov', 'Belov'],
  },
  chinese: {
    male: ['Wei', 'Jun', 'Hao', 'Lei', 'Ming', 'Jian', 'Tao', 'Yong', 'Bo', 'Chen', 'Zhi', 'Long', 'Feng', 'Kai'],
    female: ['Mei', 'Li', 'Xiu', 'Lan', 'Hua', 'Ying', 'Fang', 'Jing', 'Yan', 'Ling', 'Xin', 'Hui', 'Qing', 'Yue'],
    last: ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou', 'Xu', 'Sun', 'Ma', 'Zhu'],
  },
  japanese: {
    male: ['Hiroshi', 'Takeshi', 'Kenji', 'Haruto', 'Ren', 'Sora', 'Daiki', 'Kaito', 'Yuto', 'Shinji', 'Akira', 'Kazuo', 'Riku', 'Hayato'],
    female: ['Yuki', 'Aiko', 'Sakura', 'Hana', 'Yui', 'Mei', 'Rin', 'Akane', 'Emi', 'Keiko', 'Naomi', 'Haruka', 'Misaki', 'Ayaka'],
    last: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida', 'Yamada', 'Matsumoto', 'Inoue'],
  },
  indian: {
    male: ['Arjun', 'Rahul', 'Vikram', 'Aditya', 'Rohan', 'Sanjay', 'Amit', 'Ravi', 'Karan', 'Dev', 'Ishaan', 'Nikhil', 'Pranav', 'Rajesh'],
    female: ['Priya', 'Ananya', 'Aisha', 'Kavya', 'Neha', 'Pooja', 'Divya', 'Meera', 'Riya', 'Sita', 'Lakshmi', 'Anjali', 'Isha', 'Tara'],
    last: ['Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Reddy', 'Iyer', 'Nair', 'Mehta', 'Chopra', 'Joshi', 'Rao', 'Desai', 'Kapoor'],
  },
  arabic: {
    male: ['Mohammed', 'Ahmed', 'Omar', 'Ali', 'Hassan', 'Youssef', 'Khalid', 'Tariq', 'Karim', 'Samir', 'Faisal', 'Nabil', 'Ibrahim', 'Mustafa'],
    female: ['Fatima', 'Aisha', 'Layla', 'Mariam', 'Nour', 'Salma', 'Yasmin', 'Huda', 'Rania', 'Zainab', 'Amira', 'Dalia', 'Leila', 'Samira'],
    last: ['Al-Sayed', 'Hassan', 'Mansour', 'Haddad', 'Khalil', 'Nasser', 'Farouk', 'Saleh', 'Aziz', 'Rahman', 'Qureshi', 'Darwish', 'Hamdan', 'Sharif'],
  },
  persian: {
    male: ['Dariush', 'Cyrus', 'Reza', 'Amir', 'Farhad', 'Kian', 'Arash', 'Babak', 'Navid', 'Payam', 'Omid', 'Siavash'],
    female: ['Shirin', 'Parisa', 'Roya', 'Leila', 'Nasrin', 'Mina', 'Yasaman', 'Laleh', 'Soraya', 'Azadeh', 'Ladan', 'Darya'],
    last: ['Ahmadi', 'Hosseini', 'Karimi', 'Rahimi', 'Moradi', 'Jafari', 'Rostami', 'Tehrani', 'Farahani', 'Kazemi', 'Sadeghi', 'Ebrahimi'],
  },
  greek: {
    male: ['Alexandros', 'Dimitrios', 'Nikolaos', 'Georgios', 'Konstantinos', 'Andreas', 'Stavros', 'Leonidas', 'Theodoros', 'Socrates', 'Pericles', 'Yannis'],
    female: ['Eleni', 'Sophia', 'Maria', 'Katerina', 'Ioanna', 'Athena', 'Despina', 'Penelope', 'Daphne', 'Irene', 'Chrysa', 'Thalia'],
    last: ['Papadopoulos', 'Nikolaidis', 'Georgiou', 'Dimitriou', 'Konstantinou', 'Pappas', 'Vlachos', 'Angelopoulos', 'Karras', 'Stathopoulos', 'Makris', 'Christou'],
  },
  yoruba: {
    male: ['Adebayo', 'Oluwaseun', 'Chinedu', 'Emeka', 'Babatunde', 'Femi', 'Tunde', 'Kunle', 'Ikenna', 'Obinna', 'Segun', 'Ayodele'],
    female: ['Adaeze', 'Ngozi', 'Folake', 'Chiamaka', 'Funmilayo', 'Yetunde', 'Amaka', 'Bukola', 'Ifeoma', 'Titilayo', 'Kemi', 'Zainab'],
    last: ['Adeyemi', 'Okafor', 'Okonkwo', 'Balogun', 'Eze', 'Adebayo', 'Nwosu', 'Ogunleye', 'Bello', 'Afolabi', 'Chukwu', 'Olawale'],
  },
  southAfrican: {
    male: ['Thabo', 'Sipho', 'Johan', 'Pieter', 'Mandla', 'Lwazi', 'Bongani', 'Kagiso', 'Ruan', 'Themba', 'Andile', 'Willem'],
    female: ['Thandiwe', 'Nomvula', 'Lerato', 'Annelie', 'Zanele', 'Naledi', 'Busisiwe', 'Marike', 'Ayanda', 'Palesa', 'Karabo', 'Elsa'],
    last: ['Nkosi', 'Dlamini', 'van der Merwe', 'Botha', 'Mokoena', 'Ndlovu', 'Khumalo', 'Pretorius', 'Mthembu', 'du Plessis', 'Zulu', 'Venter'],
  },
};

export const NICKNAMES_TOUGH = ['the Knife', 'Two-Times', 'Ghost', 'the Butcher', 'Silk', 'Ironjaw', 'the Accountant', 'Smiley', 'Viper', 'Deacon', 'the Saint', 'Lucky'];

export const ORG_NAMES = [
  'the Black Hand',
  'the Iron Circle',
  'the Northside Crew',
  'the Serpent Cartel',
  'the Red Lantern Society',
  'the Harbor Syndicate',
  'the Velvet Family',
  'the Ash Street Boys',
  'Los Lobos',
  'the Golden Triangle Combine',
  'the Crowned Fist',
  'the Sixth Ward Outfit',
];

export const PARTY_NAMES = ['the Progress Party', 'the National Union', 'the Liberty Alliance', 'the Workers Front', 'the Civic Movement', 'the Conservative League', 'the Green Coalition', 'the Reform Party'];

export const COMPANY_WORDS_A = ['Apex', 'Northwind', 'Blue Harbor', 'Ironclad', 'Summit', 'Crescent', 'Meridian', 'Pinnacle', 'Silverline', 'Evergreen', 'Atlas', 'Vanguard', 'Orion', 'Keystone', 'Redwood'];
export const COMPANY_WORDS_B = ['Holdings', 'Group', 'Industries', 'Partners', '& Co.', 'Works', 'Associates', 'Enterprises', 'Labs', 'Trust', 'Consolidated', 'Systems'];

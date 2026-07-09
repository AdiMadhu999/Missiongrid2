const fs = require('fs');
let imports = fs.readFileSync('src/screens/test/TestCreateEdit.tsx', 'utf8');
imports = imports.replace('import { collection, query, where, getDocs, addDoc } from "firebase/firestore";', 'import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";');
fs.writeFileSync('src/screens/test/TestCreateEdit.tsx', imports);

// Importe as funções necessárias dos SDKs que você precisa
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-analytics.js";

// A configuração do seu aplicativo da web do Firebase, que você pode encontrar no console do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDXqidXp2Z--2FK_egME8SOJKrKeJO-Qps",
  authDomain: "sisprof-20843.firebaseapp.com",
  projectId: "sisprof-20843",
  storageBucket: "sisprof-20843.appspot.com",
  messagingSenderId: "986359106683",
  appId: "1:986359106683:web:06eba7bb055e6baac166de",
  measurementId: "G-X7C33EVGX8"
};

// Inicialize o Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Exporte os serviços do Firebase para serem usados em outros lugares
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("Firebase inicializado com sucesso!");
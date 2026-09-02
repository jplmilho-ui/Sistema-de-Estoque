// URL base do backend (estoque-backend).

// Ajustar conforme onde estiver rodando o app:
// - Web (npm run web / expo start --web): 'http://localhost:3333' funciona.
// - Emulador Android: use 'http://10.0.2.2:3333' (o emulador enxerga o
//   localhost do seu PC nesse endereço, não em 'localhost').
// - Celular físico com Expo Go: use o IP da sua máquina na rede local,
//   por exemplo 'http://192.168.0.10:3333'. Celular e PC precisam estar
//   na mesma rede Wi-Fi. Para descobrir seu IP: `ipconfig` (Windows) ou
//   `ifconfig` / `ip a` (Mac/Linux).
export const API_URL = 'http://localhost:3333';

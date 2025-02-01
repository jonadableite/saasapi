// src/services/Chatbot/IsContactTest.ts
const IsContactTest = async (
  celularContato: string | undefined,
  celularTeste: string,
  channel: string | undefined,
): Promise<boolean> => {
  if (channel !== "whatsapp") return false;
  if (
    (celularTeste && celularContato?.indexOf(celularTeste.substr(1)) === -1) ||
    !celularContato
  ) {
    return true;
  }
  return false;
};

export default IsContactTest;

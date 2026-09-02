import React, { useState } from 'react';
import {View, Text,TextInput,TouchableOpacity, StyleSheet, ActivityIndicator,} from 'react-native';
import { router } from "expo-router";
import { registerUser, loginUser } from "../services/authApi";
import { saveSession } from "../services/authStorage";

const SENHA_MINIMA = 8;
const max_string = 105;

export default function login(){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  function clearErrorOnChange(setter) {
    return (text) => {
      setter(text);
      if (errorMessage) setErrorMessage('');
    };
  }

  async function handleCadastro() {
    setErrorMessage('');

    if (!name || !email || !password || !confirmPassword) {
      setErrorMessage('Preencha todos os campos.');
      return;
    }

    if (email.length > max_string) {
      setErrorMessage(`O email não pode ter mais de ${max_string} caracteres`);
      return;
    }

    if (password.length < SENHA_MINIMA) {
      setErrorMessage(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('A confirmação precisa ser igual à senha.');
      return;
    }

    setLoading(true);
    try {
      // O backend cria o usuário no banco com a senha já criptografada (bcrypt.hash).
      await registerUser(name.trim(), email.trim(), password);

      // Loga automaticamente logo em seguida: essa chamada consulta o
      // usuário recém-criado no banco de dados e devolve o token.
      const { user, token } = await loginUser(email.trim(), password);
      await saveSession(token, user);

      router.replace("/tela_inicial");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

return (
  
  <View style={styles.container}>
    
    <View style={styles.card}>
      <Text style={styles.title}>Criar conta</Text>
      <Text style={styles.subtitle}>Faça seu cadastro</Text>
      

      <TextInput
          style={styles.input}
          placeholder="Nome"
          value={name}
          onChangeText={clearErrorOnChange(setName)}
          autoCapitalize="words"
          editable={!loading}
        />
 
      <TextInput
          style={styles.input}
          placeholder="E-mail"
          value={email}
          onChangeText={clearErrorOnChange(setEmail)}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
      />
        <TextInput
          style={styles.input}
          placeholder="Senha (mínimo 8 caracteres)"
          value={password}
          onChangeText={clearErrorOnChange(setPassword)}
          secureTextEntry
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Confirmar Senha"
          value={confirmPassword}
          onChangeText={clearErrorOnChange(setConfirmPassword)}
          secureTextEntry
          editable={!loading}
        />

        {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <View style={styles.footer}>


          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleCadastro}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Criar conta</Text>
            )}
          </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/")} disabled={loading}>
            <Text style={styles.link}>Já tenho uma conta</Text>
          </TouchableOpacity>
        </View>
      </View>

  </View>
  );
}


const styles = StyleSheet.create({
 container: {
  flex: 1,
  backgroundColor: '#949494',
  justifyContent: 'center',
  alignItems: 'center' ,
},

card: {
  width: '100%',
  maxWidth: 450,
  minHeight: 480,
  backgroundColor: '#eaeaea',
  borderRadius: 10,
  padding: 24,
  justifyContent: 'center',
  alignItems: 'center',
},

title: {
  fontSize: 24,
  fontWeight: '400',
  color:'#202124',
  textAlign: 'center',
  marginBottom: 20,
},

subtitle: {
  fontSize: 15,
  color: '#5f6368',
  textAlign: 'center',
  marginBottom: 32,
},
  input: {
    width: 350,
    borderWidth: 2,
    borderColor:'#a9aaac',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
    color:'#202124',
    marginBottom: 12,
  },
  errorText: {
    width: 350,
    color: '#c62828',
    fontSize: 13,
    marginTop: -6,
    marginBottom: 12,
  },
  footer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 1,

  },
  button: {
    backgroundColor: '#ed0000',
    borderRadius: 6,
    paddingHorizontal: 26,
    paddingVertical: 14,
    minWidth: 130,
    alignItems: 'center',
    justifyContent: 'center',
  }, 
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
     color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
      link: {
    marginTop: 18,
    fontSize: 14,
    color: '#054fb0',
    fontWeight: '500',
  }
});

import React, { useState } from 'react';
import {View, Text,TextInput,TouchableOpacity, StyleSheet, ActivityIndicator,} from 'react-native';
import { router } from "expo-router";
import { loginUser } from "../services/authApi";
import { saveSession } from "../services/authStorage";

export default function login(){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleLogin() {
    setErrorMessage('');

    if (!email || !password) {
      setErrorMessage('Preencha e-mail e senha.');
      return;
    }

    setLoading(true);
    try {
      // Vai até o backend, que consulta o usuário no banco de dados,
      // confere a senha (bcrypt.compare) e devolve o token JWT.
      const { user, token } = await loginUser(email.trim(), password);

      await saveSession(token, user);

      router.replace("/tela_inicial");
    } catch (error) {
      // Mensagem genérica
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

return (
  <View style={styles.container}>

    <View style={styles.card}>
      <Text style={styles.title}>Fazer login</Text>
      <Text style={styles.subtitle}>Entre com seu cadastro</Text>

      <TextInput
          style={styles.input}
          placeholder="E-mail"
          value={email}
          onChangeText={(text) => { setEmail(text); if (errorMessage) setErrorMessage(''); }}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
      />
        <TextInput
          style={styles.input}
          placeholder="Senha"
          value={password}
          onChangeText={(text) => { setPassword(text); if (errorMessage) setErrorMessage(''); }}
          secureTextEntry
          editable={!loading}
        />

        {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <View style={styles.footer}>


          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/cadastro")} disabled={loading}>
            <Text style={styles.link}>Criar uma conta</Text>
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
  minHeight: 370,
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
    marginTop: 8,

  },
  button: {
    backgroundColor: '#ed0000',
    borderRadius: 6,
    paddingHorizontal: 26,
    paddingVertical: 14,
    minWidth: 110,
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

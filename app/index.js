import React, { useState } from 'react';
import {View,Text,TextInput,TouchableOpacity,StyleSheet,ActivityIndicator,Image,Alert,
} from 'react-native';
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

      // O aluno tem uma versão reduzida do sistema: só a tela de
      // Solicitações. Os demais perfis entram pela Tela Inicial.
      router.replace(user?.role === "aluno" ? "/solicitacoes" : "/tela_inicial");
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

        <Image
          source={require("../assets/logo_sece_minimalista.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>Área de login</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={(text) => { setEmail(text); if (errorMessage) setErrorMessage(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={(text) => { setPassword(text); if (errorMessage) setErrorMessage(''); }}
            secureTextEntry
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={styles.forgotWrapper}
          disabled={loading}
          onPress={() =>
            Alert.alert(
              "Em breve",
              "A recuperação de senha ainda não foi implementada."
            )
          }
        >
          <Text style={styles.forgotLink}>Esqueceu a senha?</Text>
        </TouchableOpacity>

        {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#1a1a1a" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },

  logo: {
    width: 110,
    height: 148,
    marginBottom: 16,
  },

  title: {
    fontFamily: 'serif',
    fontSize: 20,
    color: '#202124',
    textAlign: 'center',
    marginBottom: 32,
  },

  field: {
    width: '100%',
    marginBottom: 16,
  },

  label: {
    fontSize: 13,
    color: '#3c3c3c',
    marginBottom: 6,
  },

  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#c9c9c9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#202124',
    backgroundColor: '#ffffff',
  },

  forgotWrapper: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 24,
  },

  forgotLink: {
    fontSize: 12,
    color: '#3c3c3c',
  },

  errorText: {
    width: '100%',
    color: '#c62828',
    fontSize: 13,
    marginTop: -12,
    marginBottom: 16,
  },

  button: {
    width: '100%',
    backgroundColor: '#8FC1A9',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
  },
});
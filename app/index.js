import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { loginUser } from '../services/authApi';
import { saveSession } from '../services/authStorage';

export default function Login() {
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
      const { user, token } = await loginUser(
        email.trim(),
        password
      );

      await saveSession(token, user);

      // O aluno tem uma versão reduzida do sistema: só a tela de
      // Solicitações. Os demais perfis entram pela Tela Inicial.
      router.replace(
        user?.role === 'aluno'
          ? '/solicitacoes'
          : '/tela_inicial'
      );
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>

        <Image
          source={require('../assets/logo_sece_minimalista.png')}
          style={styles.logo}
          resizeMode="contain"
          accessible={true}
          accessibilityLabel="Logotipo SECE - Sistema de Estoque do Curso de Enfermagem"
        />

        <Text
          style={styles.title}
          accessibilityRole="header"
          aria-level={1}
        >
          Área de login
        </Text>

        <View style={styles.field}>
          <Text style={styles.label} nativeID="emailLabel">
            Email
          </Text>

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={(text) => {
              setEmail(text);

              if (errorMessage) {
                setErrorMessage('');
              }
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            editable={!loading}
            accessible={true}
            accessibilityLabel="Email"
            accessibilityHint="Digite o seu endereço de e-mail cadastrado"
            aria-labelledby="emailLabel"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label} nativeID="senhaLabel">
            Senha
          </Text>

          <TextInput
            style={styles.input}
            value={password}
            onChangeText={(text) => {
              setPassword(text);

              if (errorMessage) {
                setErrorMessage('');
              }
            }}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            editable={!loading}
            accessible={true}
            accessibilityLabel="Senha"
            accessibilityHint="Digite a sua senha de acesso"
            aria-labelledby="senhaLabel"
          />
        </View>

        <TouchableOpacity
          style={styles.forgotWrapper}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Esqueceu a senha?"
          accessibilityHint="Exibe orientações de como redefinir a sua senha com a coordenação"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() =>
            Alert.alert(
              'Esqueceu a senha?',
              'Procure a coordenação da escola: ela pode redefinir a sua senha.'
            )
          }
        >
          <Text style={styles.forgotLink}>
            Esqueceu a senha?
          </Text>
        </TouchableOpacity>

        {!!errorMessage && (
          <Text
            style={styles.errorText}
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
          >
            {errorMessage}
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            loading && styles.buttonDisabled,
          ]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={loading ? "Entrando..." : "Entrar no sistema"}
          accessibilityHint="Autentica suas credenciais e entra no sistema de estoque"
          accessibilityState={{ busy: loading, disabled: loading }}
        >
          {loading ? (
            <ActivityIndicator color="#101111" accessibilityLabel="Entrando no sistema..." />
          ) : (
            <Text style={styles.buttonText}>
              Login
            </Text>
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
    fontFamily: 'Inter',
    fontSize: 24,
    color: '#202124',
    textAlign: 'center',
    marginBottom: 32,
  },

  field: {
    width: '100%',
    marginBottom: 16,
  },

  label: {
    fontSize: 15,
    color: '#3c3c3c',
    marginBottom: 6,
    fontFamily: 'Inter',
  },

  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#c9c9c9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 17,
    color: '#202124',
    backgroundColor: '#ffffff',
    fontFamily: 'Inter',
  },

  forgotWrapper: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 24,
  },

  forgotLink: {
    fontSize: 14,
    color: '#3c3c3c',
    fontFamily: 'Inter',
    textDecorationLine: "underline"
  },

  errorText: {
    width: '100%',
    color: '#c62828',
    fontSize: 15,
    marginTop: -12,
    marginBottom: 16,
    fontFamily: 'Inter',
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
    color: '#101111',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});

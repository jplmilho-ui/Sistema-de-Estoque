import React, { useState } from 'react';
import {View, Text,TextInput,TouchableOpacity, StyleSheet, Alert,} from 'react-native';
import { router } from "expo-router";

export default function login(){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

return (
  <View style={styles.container}>

    <View style={styles.card}>
      <Text style={styles.title}>Fazer login</Text>
      <Text style={styles.subtitle}>Entre com seu cadastro</Text>

      <TextInput
          style={styles.input}
          placeholder="E-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
      />
        <TextInput
          style={styles.input}
          placeholder="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <View style={styles.footer}>


          <TouchableOpacity style={styles.button} onPress={() => router.push("/dashboard")}>
            <Text style={styles.buttonText}>Entrar</Text>
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
  height: 400,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,

  },
  button: {
    backgroundColor: '#ed0000',
    borderRadius: 6,
    paddingHorizontal: 26,
    paddingVertical: 14,
    placeholder: 'blue'
  }, 
  buttonText: {
     color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
});

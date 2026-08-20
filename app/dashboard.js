import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import AppBar from "../components/AppBar";
import PageHeader from "../components/PageHeader";
import SearchBox from "../components/SearchBox";

export default function Dashboard() {
  return (
    <AppBar>
      <PageHeader
        title="Dashboard"
        actions={
          <>
          
            <TouchableOpacity style={styles.retirarButton}>
              <Text style={styles.retirarButtonText}>Retirar Item</Text>
            </TouchableOpacity>

            <SearchBox />
          </>
        }
      />
      <View style={styles.Space}>

        <View style={styles.contentArea}> 
            <Text style={styles.retirarButtonText}>Retirar Item</Text>

            <TouchableOpacity style={styles.retirarButton}>
              <Text style={styles.retirarButtonText}>Retirar Item</Text>
            </TouchableOpacity>

          
        </View>
      </View>

      
    </AppBar>
  );
}

const styles = StyleSheet.create({
  retirarButton: {
    borderWidth: 1,
    borderColor: "#b1b1b1",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",

  },
  retirarButtonText: {
    fontSize: 13,
    color: "#1a1a1a",
  },
  contentArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e6e6e6",
    borderRadius: 10,
    width: "auto",
    maxHeight: "auto",
    gap: 30
  },
  Space: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 30,
    
  },
  headerContainer: {
    flex:1,
    flexDirection: "row",
  },
  
  container1: {
    flex: 1,
    width: 50,
    maxHeight:50,
    backgroundColor: "black"
  }
});

'use dom';
import Link from 'expo-router/link';
import { Text, View } from 'react-native';


export default function DOMComponent({ }: { dom: import('expo/dom').DOMProps }) {
    console.log({ window })
    return (
        <div style={{ height: "200px", flexDirection: "column" }}>
            <h1>Hello, world!</h1>
            <View style={{ flexDirection: "column" }}>

                <Link href="/(tabs)">About</Link>
                <Text style={{ color: "black" }}>Explore</Text>
            </View>
        </div>
    );
}

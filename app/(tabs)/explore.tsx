import React, { useCallback, useRef } from "react";
import {
  Alert,
  Button,
  Platform,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import { WebViewMessageEvent } from "react-native-webview";
import WebView from "@portal-hq/webview";
import { toast } from "sonner-native";

/**
 * We inject a basic EIP-1193 window.ethereum provider via a string of JS.
 * This code runs inside the WebView as soon as it's loaded.
 */
const injectedJavaScript = `
(function () {
  if (window.ethereum) {
    // If a provider is already there, don't overwrite it
    return;
  }

  // Minimal EIP-1193 provider mock
  const eip1193Provider = {
    isMetaMask: true, // So that Uniswap thinks we are a MetaMask-like provider

    request: async ({ method, params }) => {
      return new Promise((resolve, reject) => {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'ETH_REQUEST',
            method,
            params
          })
        );

        // We'll wait for the native side to post back a matching "ETH_RESPONSE" with the same method.
        const handleMessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'ETH_RESPONSE' && data.method === method) {
              window.removeEventListener('message', handleMessage);
              if (data.success) {
                resolve(data.result);
              } else {
                reject(new Error(data.errorMessage || 'Request failed'));
              }
            }
          } catch (err) {
            // Ignore parse errors for non-JSON messages
          }
        };

        window.addEventListener('message', handleMessage);
      });
    }
  };

  // Assign our provider
  window.ethereum = eip1193Provider;

  // Optional: Auto-trigger connection after a brief delay
  setTimeout(() => {
    window.ethereum.request({ method: 'eth_requestAccounts' });
  }, 3000);
})();
true; // must return true or nothing from this script
`;

export default function App() {
  // const webviewRef = useRef<WebView>(null);

  /**
   * handleWebViewMessage
   * Called when the WebView sends us a message (via postMessage).
   */
  const handleWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ETH_REQUEST") {
        onEthereumRequest(data.method, data.params);
      }
    } catch (error) {
      console.warn("Error parsing message from web:", error);
    }
  }, []);

  /**
   * onEthereumRequest
   * Our main EIP-1193 method handler.
   * This is called whenever the dApp calls ethereum.request({ method, params }).
   */
  const onEthereumRequest = (method: string, params?: any) => {
    console.log(`[EIP-1193 REQUEST] method=${method}`, params);

    switch (method) {
      case "eth_requestAccounts":
        // user clicked "Connect"
        Alert.alert(
          "Connection Request",
          "Uniswap wants to connect your wallet.\nAllow?",
          [
            {
              text: "Reject",
              style: "destructive",
              onPress: () => {
                toast.error("User rejected wallet connection.");
                sendWebViewResponse(method, false, "User rejected connection");
              },
            },
            {
              text: "Allow",
              onPress: () => {
                toast.success("Wallet connected (mock).");
                // Return a dummy account
                sendWebViewResponse(method, true, ["0xDUMMY_WALLET_ADDRESS"]);
              },
            },
          ]
        );
        break;

      case "eth_chainId":
        // Return a mock Ethereum mainnet chainId
        console.log("[eth_chainId] returning 0x1");
        sendWebViewResponse(method, true, "0x1");
        break;

      case "net_version":
        // Some apps check net_version as well
        console.log('[net_version] returning "1" (mainnet)');
        sendWebViewResponse(method, true, "1");
        break;

      case "eth_accounts":
        // Return the currently connected accounts
        console.log("[eth_accounts] returning mock account");
        sendWebViewResponse(method, true, ["0xDUMMY_WALLET_ADDRESS"]);
        break;

      case "eth_sendTransaction":
        // user clicked "Swap" or some transaction button
        Alert.alert(
          "Transaction Request",
          "Uniswap wants to send a transaction.\nApprove transaction?",
          [
            {
              text: "Reject",
              style: "destructive",
              onPress: () => {
                toast.error("Transaction rejected.");
                sendWebViewResponse(method, false, "User rejected transaction");
              },
            },
            {
              text: "Approve",
              onPress: () => {
                // Return a dummy hash
                const dummyHash = "0xDUMMY_TRANSACTION_HASH";
                toast.success(`Transaction approved (mock): ${dummyHash}`);
                sendWebViewResponse(method, true, dummyHash);
              },
            },
          ]
        );
        break;

      case "wallet_switchEthereumChain":
        // Uniswap might want to ensure we're on mainnet (0x1).
        // For demonstration, automatically "approve" the chain switch
        console.log("[wallet_switchEthereumChain] -> mocked success");
        toast("Switching Ethereum chain (mock success).");
        sendWebViewResponse(method, true, null);
        break;

      case "personal_sign":
        // Some dApps might ask for personal_sign
        {
          console.log("[personal_sign] request =>", params);
          // params usually [message, address]
          const [message, address] = params || [];
          Alert.alert(
            "Signature Request",
            `Uniswap wants to sign:\n${message}\nWith address:\n${address}\nAllow?`,
            [
              {
                text: "Reject",
                style: "destructive",
                onPress: () => {
                  toast.error("Signature rejected.");
                  sendWebViewResponse(method, false, "User rejected signature");
                },
              },
              {
                text: "Allow",
                onPress: () => {
                  const dummySig = "0xFAKE_SIGNATURE";
                  toast.success(`Signed: ${dummySig.substring(0, 12)}...`);
                  sendWebViewResponse(method, true, dummySig);
                },
              },
            ]
          );
        }
        break;

      default:
        // If there's a method we don't handle, return an error
        console.log("[EIP-1193] Unrecognized method:", method);
        toast.error(`Method not supported: ${method}`);
        sendWebViewResponse(method, false, `Method not supported: ${method}`);
        break;
    }
  };

  /**
   * sendWebViewResponse
   * Post a message back to the WebView with the result or error.
   */
  const sendWebViewResponse = (
    method: string,
    success: boolean,
    resultOrError: any
  ) => {
    console.log(
      `[RESPONSE to ${method}] success=${success}, data=`,
      resultOrError
    );
    // if (webviewRef.current) {
    //   webviewRef.current.postMessage(
    //     JSON.stringify({
    //       type: 'ETH_RESPONSE',
    //       method,
    //       success,
    //       result: success ? resultOrError : undefined,
    //       errorMessage: success ? undefined : resultOrError,
    //     })
    //   );
    // }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.container}>
        <WebView
          // ref={webviewRef}
          url='https://app.uniswap.org'
          // onMessage={handleWebViewMessage}
          // injectedJavaScript={injectedJavaScript}
          // javaScriptEnabled={true}
          // originWhitelist={['*']}
          // Force a user agent that might appear as a desktop browser:
          // userAgent={
          //   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
          //   'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          //   'Chrome/90.0.4430.212 Safari/537.36'
          // }
          // allowsInlineMediaPlayback
          // startInLoadingState
          // style={{ flex: 1 }}
        />
      </View>

      {/* Debug Button (Optional) */}
      <Button
        title='Debug: Manually Connect'
        onPress={() => {
          onEthereumRequest("eth_requestAccounts");
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});

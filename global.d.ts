declare global {
    interface Window {
        ethereum?: any; // You can replace `any` with a specific type if you know the Ethereum object structure
    }
}
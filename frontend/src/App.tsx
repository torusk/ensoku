import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useDisconnectWallet, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState, useEffect } from 'react';
import { MapPin, Loader2, CheckCircle2, LogOut, Coffee, Droplets, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { getGoogleOAuthUrl, parseJwtFromUrl, getSuiAddressFromJwt } from './utils/zkLogin';

// Configuration
const PACKAGE_ID = '0xaa482b655edc850567b18bc546272ac13bb6aee4fb548bdb4d663b67d19a9bfb';
const MODULE_NAME = 'ensoku';

// Types
type AppState = 'departure' | 'excursion' | 'home';

function App() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { data: ownedObjects, refetch: refetchObjects } = useSuiClientQuery('getOwnedObjects', {
    owner: account?.address || '',
    options: { showContent: true, showDisplay: true },
  }, {
    enabled: !!account,
  });

  const [appState, setAppState] = useState<AppState>('departure');
  const [zkLoginAddress, setZkLoginAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [isPouring, setIsPouring] = useState(false);

  const userAddress = account?.address || zkLoginAddress;

  // Handle Google Login Redirect
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('id_token')) {
      const idToken = parseJwtFromUrl(hash);
      if (idToken) {
        try {
          const address = getSuiAddressFromJwt(idToken);
          setZkLoginAddress(address);
          window.history.replaceState(null, '', window.location.pathname);
          setAppState('excursion');
        } catch (e) {
          console.error('Error deriving address:', e);
          setStatus({ type: 'error', message: 'ログインに失敗しました。' });
        }
      }
    }
  }, []);

  // Sync wallet connection state with app state
  useEffect(() => {
    if (account) {
      setAppState('excursion');
    } else if (zkLoginAddress) {
      setAppState('excursion');
    } else {
      setAppState('departure');
    }
  }, [account, zkLoginAddress]);

  const handleDisconnect = () => {
    if (account) disconnect();
    setZkLoginAddress(null);
    setAppState('departure');
  };

  const handlePourWater = async () => {
    if (!userAddress) return;
    setIsPouring(true);
    setStatus(null);

    try {
      const response = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: userAddress }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', message: '給水完了！水筒に0.05 SUI入りました！' });
      } else {
        throw new Error(data.error || '給水に失敗しました');
      }
    } catch (error: any) {
      console.error('Faucet error:', error);
      // Fallback for local development without API (Simulation)
      if (error.message.includes('Unexpected token') || error.message.includes('404')) {
        console.warn('API not found, falling back to simulation');
        setTimeout(() => {
          setStatus({ type: 'success', message: '給水完了！(Simulation Mode)' });
          setIsPouring(false);
        }, 1000);
        return;
      }
      setStatus({ type: 'error', message: `給水失敗: ${error.message}` });
    } finally {
      setIsPouring(false);
    }
  };

  const handleMintSnack = () => {
    if (!userAddress) return;
    setIsMinting(true);
    setStatus(null);

    if (zkLoginAddress) {
      // zkLogin Simulation for MVP (Since we don't have the ephemeral key logic in frontend yet)
      setTimeout(() => {
        setStatus({ type: 'success', message: 'おやつを拾いました！ (zkLogin Simulation)' });
        setIsMinting(false);
      }, 2000);
      return;
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::mint_snack`,
      arguments: [
        tx.pure.string("Tokyo"), // Location (Mock)
        tx.pure.string("Sakura Mochi"), // Flavor
        tx.pure.string("#FFB7C5"), // Color
      ],
    });

    signAndExecuteTransaction(
      { transaction: tx },
      {
        onSuccess: (result) => {
          console.log('Mint success:', result);
          setStatus({ type: 'success', message: 'おやつを買いました！' });
          setIsMinting(false);
          refetchObjects();
        },
        onError: (error) => {
          console.error('Mint failed:', error);
          setStatus({ type: 'error', message: `失敗しました: ${error.message}` });
          setIsMinting(false);
        },
      },
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-slate-50 font-sans text-slate-900">
      {/* Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-green-400/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-teal-400/20 rounded-full blur-[120px] pointer-events-none" />

      <main className="w-full max-w-md z-10 space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-teal-600">
              Ensoku
            </h1>
            <p className="text-xs text-slate-500 font-medium">家に帰るまでが遠足</p>
          </div>
          {userAddress && (
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-mono text-slate-600">
                {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
              </span>
            </div>
          )}
        </header>

        {/* Status Message */}
        <AnimatePresence mode="wait">
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={clsx(
                "p-3 rounded-xl flex items-center gap-3 text-sm font-medium shadow-sm",
                status.type === 'success' ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
              )}
            >
              <CheckCircle2 className="w-5 h-5" />
              {status.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <div className="relative min-h-[400px]">
          <AnimatePresence mode="wait">

            {/* PHASE 1: DEPARTURE (Login) */}
            {appState === 'departure' && (
              <motion.div
                key="departure"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="glass-card p-8 text-center space-y-6">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MapPin className="w-10 h-10 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">遠足に出かけよう！</h2>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Sui筒（ウォレット）を持って、<br />
                    デジタルな遠足に出発しませんか？<br />
                    Googleアカウントですぐに始められます。
                  </p>

                  <div className="space-y-3 pt-4">
                    <a
                      href={getGoogleOAuthUrl()}
                      className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm hover:shadow-md group"
                    >
                      <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity" />
                      Googleで出発
                    </a>
                    <div className="relative flex items-center py-2">
                      <div className="flex-grow border-t border-slate-200"></div>
                      <span className="flex-shrink-0 mx-4 text-xs text-slate-400 font-medium">または</span>
                      <div className="flex-grow border-t border-slate-200"></div>
                    </div>
                    <div className="[&>button]:!w-full [&>button]:!justify-center [&>button]:!bg-slate-900 [&>button]:!text-white [&>button]:!rounded-xl [&>button]:!font-medium [&>button]:!px-6 [&>button]:!py-4 [&>button]:hover:!bg-slate-800 [&>button]:!transition-all [&>button]:!shadow-sm [&>button]:!h-auto">
                      <ConnectButton />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* PHASE 2: EXCURSION (Activity) */}
            {appState === 'excursion' && (
              <motion.div
                key="excursion"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* 1. Spring Water (Faucet) */}
                <div className="glass-card p-6 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Droplets className="w-5 h-5 text-blue-500" />
                      給水ポイント
                    </h3>
                    <p className="text-xs text-slate-500">お水（SUI）を補給します</p>
                  </div>
                  <button
                    onClick={handlePourWater}
                    disabled={isPouring}
                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    {isPouring ? <Loader2 className="w-5 h-5 animate-spin" /> : '水筒にSUIを入れる'}
                  </button>
                </div>

                {/* 2. Snack Picking (Mint) */}
                <div className="glass-card p-6 space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Coffee className="w-5 h-5 text-orange-500" />
                      おやつを買う
                    </h3>
                    <p className="text-xs text-slate-500">この場所限定のおやつを買おう</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center">
                    <div className="text-4xl mb-2">🍡</div>
                    <p className="text-sm font-medium text-slate-700">東京の桜餅</p>
                  </div>

                  <button
                    onClick={handleMintSnack}
                    disabled={isMinting}
                    className="w-full py-3 bg-gradient-to-r from-orange-400 to-pink-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {isMinting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> 買っています...
                      </span>
                    ) : (
                      'おやつを買う！'
                    )}
                  </button>
                </div>

                {/* Navigation to Home */}
                <button
                  onClick={() => setAppState('home')}
                  className="w-full py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Home className="w-5 h-5" />
                  おうちに帰る
                </button>
              </motion.div>
            )}

            {/* PHASE 3: HOME (Exit) */}
            {appState === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="space-y-6"
              >
                <div className="glass-card p-6 space-y-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-bold text-slate-800">ただいま！</h2>
                    <p className="text-sm text-slate-500">今日の遠足の成果を確認しましょう</p>
                  </div>

                  {/* Inventory Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-center">
                      <p className="text-xs text-blue-600 font-medium mb-1">お水 (SUI)</p>
                      <p className="text-lg font-bold text-blue-800">0.05</p>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-100 text-center">
                      <p className="text-xs text-orange-600 font-medium mb-1">おやつ (NFT)</p>
                      <p className="text-lg font-bold text-orange-800">
                        {ownedObjects?.data?.length || 0} <span className="text-xs font-normal">個</span>
                      </p>
                    </div>
                  </div>

                  {/* NFT Gallery (Simple) */}
                  {ownedObjects?.data && ownedObjects.data.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500">買ったおやつ</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {ownedObjects.data.map((obj) => {
                          const display = obj.data?.display?.data;
                          const imageUrl = display?.image_url || '';
                          return (
                            <div key={obj.data?.objectId} className="flex-shrink-0 w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                              {imageUrl ? <img src={imageUrl} alt="Snack" className="w-full h-full object-cover" /> : <span className="text-xs">?</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <p className="text-xs text-slate-500 text-center">
                      これらの思い出（資産）を、<br />
                      あなたのメインウォレットに移しますか？
                    </p>
                    <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors">
                      すべて持ち帰る (Transfer)
                    </button>
                    <button
                      onClick={() => setAppState('excursion')}
                      className="w-full py-3 text-slate-500 text-sm font-medium hover:text-slate-700"
                    >
                      まだ遊ぶ
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleDisconnect}
                  className="w-full flex items-center justify-center gap-2 text-red-400 text-sm hover:text-red-500"
                >
                  <LogOut className="w-4 h-4" />
                  ログアウトして終了
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
  TextInput,
  Button,
} from 'react-native';
import {useWindowDimensions, ActivityIndicator} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {DateTime} from 'luxon';

interface AppState {
  goals: Goal[];
  winningStreak: number;
  allGoalsCompletedFlag: boolean;
  lastResetTimeStamp: number;
}

interface Goal {
  id: number;
  title: string;
  count: number;
  originalCount: number;
  finished: boolean;
}

const App = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalCount, setNewGoalCount] = useState('');
  const [allGoalsCompletedFlag, setAllGoalsCompletedFlag] = useState(false);
  const [showActionButton, setShowActionButton] = useState(false);
  const [deactivateActionButtons, setDeactivateActionButtons] = useState(true);
  const [winningStreak, setWinningStreak] = useState<number>(0);
  const [isDataInitialized, setIsDataInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastResetTimeStamp, setLastResetTimeStamp] = useState<DateTime>(
    DateTime.now(),
  );
  const [progress, setProgress] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [animationValue] = useState(new Animated.Value(0));
  const {width, height} = useWindowDimensions();

  const PERSISTANT_KEYS = [
    'goals',
    'winningStreak',
    'allGoalsCompletedFlag',
    'lastResetTimeStamp',
  ];

  useEffect(() => {
    const initData = async () => {
      const data = await loadData();
      console.log('init data', data);
      setGoals(data.goals);
      setWinningStreak(data.winningStreak);
      setAllGoalsCompletedFlag(data.allGoalsCompletedFlag);
      setLastResetTimeStamp(DateTime.fromMillis(data.lastResetTimeStamp));
      setIsDataInitialized(true);
    };
    initData();
  }, []);

  useEffect(() => {
    if (isDataInitialized) {
      const interval = setInterval(() => {
        checkDateConditions();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isDataInitialized]);

  useEffect(() => {
    const checkConditionsAndSave = async () => {
      if (isDataInitialized) {
        checkDateConditions();
        checkGoalConditions();
        await saveData();
        setIsLoading(false);
      }
    };
    checkConditionsAndSave();
  }, [goals, winningStreak, allGoalsCompletedFlag, isDataInitialized]);

  const loadData = async (): Promise<any> => {
    try {
      const storedData = await AsyncStorage.multiGet(PERSISTANT_KEYS);
      const dataFound = storedData.every(([key, value]) => value !== null);

      if (!dataFound) {
        console.log('Erster Start der App oder leere Daten');

        const defaultValues: AppState = {
          goals: [],
          winningStreak: 0,
          allGoalsCompletedFlag: false,
          lastResetTimeStamp: DateTime.now().toMillis(),
        };
        await AsyncStorage.multiSet(serializeObject(defaultValues));
        console.log('Daten erfolgreich gespeichert!');

        return defaultValues;
      } else {
        const loadedAppState: AppState = parseLoadedDataToAppState(
          storedData as [string, string][],
        );
        console.log('Daten erfolgreich geladen:', loadedAppState);
        return loadedAppState;
      }
    } catch (error) {
      console.error('Fehler beim Laden der Ziele aus AsyncStorage: ', error);
    }
  };

  const serializeObject = (obj: {[s: string]: any}) => {
    return Object.entries(obj).map(([key, value]) => [
      key,
      JSON.stringify(value),
    ]) as [string, string][];
  };

  const parseLoadedDataToAppState = (
    storedData: [string, string][],
  ): AppState => {
    return storedData.reduce((acc, [key, value]) => {
      switch (key) {
        case 'goals':
          acc[key] = value ? (JSON.parse(value) as Goal[]) : [];
          break;
        case 'winningStreak':
          acc[key] = value ? Number(value) : 0;
          break;
        case 'allGoalsCompletedFlag':
          acc[key] = value === 'true';
          break;
        case 'lastResetTimeStamp':
          acc[key] = value ? Number(value) : DateTime.now().toMillis();
          break;
      }
      return acc;
    }, {} as AppState);
  };

  const saveData = async () => {
    const dataToSave: [string, string][] = [
      ['goals', JSON.stringify(goals)],
      ['winningStreak', JSON.stringify(winningStreak)],
      ['allGoalsCompletedFlag', JSON.stringify(allGoalsCompletedFlag)],
      ['lastResetTimeStamp', JSON.stringify(lastResetTimeStamp.toMillis())],
    ];

    try {
      await AsyncStorage.multiSet(dataToSave);
      console.log('Daten erfolgreich gespeichert!');
    } catch (error) {
      console.error('Fehler beim Speichern der Daten in AsyncStorage: ', error);
    }
  };

  const addGoal = (): void => {
    const goalCount = Math.floor(Number(newGoalCount));
    if (newGoalTitle.trim() !== '' && goalCount >= 1) {
      const newGoal: Goal = {
        id: Math.random(),
        title: newGoalTitle,
        count: goalCount,
        originalCount: goalCount,
        finished: false,
      };
      setGoals(prevGoals => {
        const updatedGoals = [...prevGoals, newGoal];
        return updatedGoals;
      });
      setNewGoalTitle('');
      setNewGoalCount('');
    }
  };

  const deleteGoal = (id: number): void => {
    setGoals(prevGoals => prevGoals.filter(goal => goal.id !== id));
  };

  const decreaseCount = (id: number): void => {
    setGoals(prevGoals => {
      const updatedGoals = prevGoals.map(goal => {
        if (goal.id === id && goal.count > 0) {
          const updatedCount = goal.count - 1;
          if (updatedCount === 0) {
            triggerAnimation();
            return {...goal, count: updatedCount, finished: true};
          }
          return {...goal, count: updatedCount};
        }
        return goal;
      });
      return updatedGoals;
    });
  };

  const checkGoalConditions = (): void => {
    const allCompleted = goals.every(goal => goal.finished);
    if (allCompleted && goals.length > 0 && !allGoalsCompletedFlag) {
      setWinningStreak(prevWinningStreak => prevWinningStreak + 1);
      setAllGoalsCompletedFlag(true);
      setShowConfetti(true);
      setTimeout(() => {
        setShowConfetti(false);
      }, 7000);
    }
  };

  const checkDateConditions = (): void => {
    const now = DateTime.now();
    const currentWeekStart = now.startOf('week');

    if (lastResetTimeStamp < currentWeekStart) {
      if (!allGoalsCompletedFlag) {
        setWinningStreak(0);
      }
      const resetGoalsCount: Goal[] = goals.map(goal => ({
        ...goal,
        count: goal.originalCount,
        finished: false,
      }));
      setGoals(resetGoalsCount);
      setAllGoalsCompletedFlag(false);
    }

    if (now.weekday === 7) {
      setDeactivateActionButtons(true);
    } else {
      setDeactivateActionButtons(false);
    }
    setLastResetTimeStamp(now);
    calculateRemainingTimeTextAndProgressBar();
  };

  const calculateRemainingTimeTextAndProgressBar = (): void => {
    const now: Date = new Date();
    const currentDay: number = now.getDay();
    const nextMonday: Date = new Date(now);

    nextMonday.setHours(0, 0, 0, 0);
    if (currentDay === 1) {
      nextMonday.setDate(now.getDate() + 7);
    } else {
      nextMonday.setDate(now.getDate() + ((7 - currentDay + 1) % 7 || 7));
    }

    const remainingHours: number =
      (nextMonday.getTime() - now.getTime()) / (1000 * 60 * 60);
    const remainingDays: number = Math.floor(remainingHours / 24);
    const remainingHoursInDays: number = Math.floor(remainingHours % 24);

    const hourStringText = remainingHoursInDays === 1 ? 'Stunde' : 'Stunden';
    const daysStringText = remainingDays === 1 ? 'Tag' : 'Tage';
    const weekAlreadyCompleted = allGoalsCompletedFlag
      ? 'entspannt zurücklehen!'
      : 'fast geschafft';
    const timeText =
      remainingDays > 0
        ? `${remainingDays} ${daysStringText} ${remainingHoursInDays} ${hourStringText}`
        : `${weekAlreadyCompleted}`;

    setTimeLeft(timeText);

    const totalHoursInWeek: number = 7 * 24;
    const progressValue: number = 1 - remainingHours / totalHoursInWeek;
    setProgress(progressValue);
  };

  const getRandomCongratsMessage = (): string => {
    if (winningStreak === 1) {
      return 'Du hast deine Wochenziele erreicht!';
    }

    if (winningStreak === 2) {
      return 'Zwei Mal hintereinander? Das könnte ein Run werden!';
    }

    const messages = [
      `Wahnsinn! Zum ${winningStreak}. Mal alles abgeräumt - deine To-Do-Liste hat wahrscheinlich Angst vor dir.`,
      `Schon ${winningStreak} Wochen in Serie - ich hoffe, du hast dir eine gute Ausrede parat, falls du irgendwann mal nicht lieferst.`,
      `Wow, zum ${winningStreak}. Mal! Es wirkt fast so, als wäre Versagen für dich nur eine literarische Erfindung.`,
      `Der ${winningStreak}. Erfolg in Folge. So konstant bist du wahrscheinlich nicht mal beim Spülen.`,
      `Zum ${winningStreak}. Mal? Die Wahrscheinlichkeit, dass du scheiterst, ist inzwischen rein theoretisch.`,
      `Der ${winningStreak}. Erfolg in Serie - ein guter Grund, heute mal stolz auf dich zu sein.`,
      `Schon ${winningStreak} Wochen in Folge. Es zeigt, wie kleine Schritte eine große Reise prägen können.`,
      `Der ${winningStreak}. Erfolg in Serie - die Gesetze der Wahrscheinlichkeit wollen dich offenbar nicht kennen.`,
      `Der ${winningStreak}. Erfolg hintereinander - das Gefühl, seine eigenen Versprechen einzuhalten, ist unbezahlbar.`,
      `Zum ${winningStreak}. Mal alles erledigt: Es ist nicht nur ein Sieg über die Aufgaben, sondern auch über die Zweifel in dir.`,
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const triggerAnimation = () => {
    Animated.timing(animationValue, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start(() => {
      animationValue.setValue(0);
    });
  };

  const renderGoal = ({item}: {item: Goal}) => {
    return (
      <View style={styles.goalContainer}>
        <TouchableOpacity
          style={[
            styles.goalItem,
            item.finished ? styles.goalFinished : styles.goalUnfinished,
          ]}
          onPress={() => !item.finished && decreaseCount(item.id)}>
          <Text style={styles.goalTitle}>{item.title}</Text>
          <Text style={styles.goalCount}>
            {item.finished ? 'erledigt' : `ausbleibend: ${item.count}`}
          </Text>
          {item.finished && (
            <Animated.View
              style={[styles.finishedIcon, {opacity: animationValue}]}>
              <Text style={styles.animationText}>✔</Text>
            </Animated.View>
          )}
        </TouchableOpacity>
        {deactivateActionButtons && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteGoal(item.id)}>
            <Text style={styles.deleteButtonText}>entfernen</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.spinnerOverlay}>
          {/* Lade Spinner */}
          <ActivityIndicator size="large" color="white" />
        </View>
      ) : (
        <View style={styles.mainSite}>
          {/* Überschrift */}
          <Text style={styles.heading}>
            <Animated.Text style={styles.headingText}>
              Weekly Goals 🎯
            </Animated.Text>
          </Text>

          {/* Konfetti Animation */}
          {showConfetti && (
            <View style={styles.confetti}>
              <ConfettiCannon
                count={200}
                origin={{x: width / 2, y: height / 2}}
              />
            </View>
          )}
          {showConfetti && (
            <Animated.View style={styles.fadeText}>
              <Text style={styles.congratsText}>
                {getRandomCongratsMessage()}
              </Text>
            </Animated.View>
          )}

          {/* Action Button */}
          {deactivateActionButtons ? (
            <>
              <Button
                title={
                  showActionButton ? 'ausblenden' : 'Neue Ziele hinzufügen'
                }
                color={showActionButton ? 'grey' : ''}
                onPress={() => setShowActionButton(!showActionButton)}
              />
            </>
          ) : (
            <Text style={styles.actionButtonsDeactivatedText}>
              Änderungen der Ziele nur Sonntags möglich.
            </Text>
          )}

          {/* Eingabefelder für Hinzufügen */}
          {showActionButton && deactivateActionButtons ? (
            <>
              <View style={styles.addDeleteContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Ziel"
                  placeholderTextColor="black"
                  value={newGoalTitle}
                  onChangeText={setNewGoalTitle}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Anzahl"
                  placeholderTextColor="black"
                  value={newGoalCount}
                  onChangeText={setNewGoalCount}
                  keyboardType="numeric"
                />
                <Button title="Ziel hinzufügen" onPress={addGoal} />
              </View>
            </>
          ) : (
            <Text />
          )}

          {/* Zielliste */}
          <FlatList
            data={goals}
            renderItem={renderGoal}
            keyExtractor={item => item.id.toString()}
          />

          {/* Winning Streak */}
          <Text style={styles.winningStreakText}>
            Winning streak:{' '}
            <Text style={styles.winningStreakCount}>{winningStreak} </Text>
            {winningStreak > 20 ? (
              <Text>🤯</Text>
            ) : winningStreak > 9 ? (
              <Text>🚀</Text>
            ) : winningStreak > 4 ? (
              <Text>😲</Text>
            ) : winningStreak > 1 ? (
              <Text>✨</Text>
            ) : (
              <Text />
            )}
          </Text>

          {/* Forschrittstext */}
          <Text style={styles.progressText}>
            Verbleibende Zeit bis zum Ende der Woche:
          </Text>
          <Text style={styles.timeText}>{timeLeft}</Text>

          {/* Fortschrittsbalken */}
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, {width: `${progress * 100}%`}]} />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  spinnerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainSite: {
    flex: 1,
    padding: 20,
  },
  heading: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  headingText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 40,
    color: '#2F4F4F',
  },
  actionButtonsDeactivatedText: {
    fontSize: 14,
    color: '#777',
    fontStyle: 'italic',
    textAlign: 'center',
  },

  confetti: {
    position: 'absolute',
    inset: 0,
    zIndex: 9,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },

  goalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalItem: {
    padding: 20,
    marginVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 4,
    elevation: 3,
    flex: 1,
    marginRight: 10,
    position: 'relative',
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  goalCount: {
    fontSize: 16,
    marginTop: 5,
  },
  goalFinished: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
  },
  goalUnfinished: {
    backgroundColor: '#f8d7da',
    borderColor: '#dc3545',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    padding: 10,
    borderRadius: 5,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  addDeleteContainer: {
    marginBottom: 20,
    marginTop: 10,
  },
  finishedIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{translateX: -20}, {translateY: -10}],
    zIndex: 10,
    padding: 10,
  },
  animationText: {
    fontSize: 24,
    color: 'green',
    fontWeight: 'bold',
  },
  fadeText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{translateX: -150}, {translateY: -50}],
    width: '80%',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    overflow: 'hidden',
    alignSelf: 'center',
    textAlign: 'center',
  },
  congratsText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    flexWrap: 'wrap',
    lineHeight: 22,
    paddingHorizontal: 10,
    flexShrink: 1,
    flexGrow: 1,
  },
  winningStreakText: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  winningStreakCount: {
    color: '#6200ee',
  },
  progressText: {
    fontSize: 16,
    marginBottom: 8,
  },
  timeText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  progressBarContainer: {
    width: '100%',
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6200ee',
  },
});

export default App;

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
import {useWindowDimensions} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [allGoalsCompleted, setAllGoalsCompleted] = useState(false);
  const [showActionButton, setShowActionButton] = useState(false);
  const [deactivateActionButtons, setDeactivateActionButtons] = useState(true);
  const [winningStreak, setWinningStreak] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [animationValue] = useState(new Animated.Value(0));
  const {width, height} = useWindowDimensions();

  useEffect(() => {
    initData();
  }, []);

  useEffect(() => {
    checkDateConditions();
    const interval = setInterval(() => {
      checkDateConditions();
    }, 1000 * 60);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    checkIfAllGoalsCompleted();
    saveGoals();
  }, [goals]);

  useEffect(() => {
    saveWinningStreak();
  }, [winningStreak]);

  const initData = async () => {
    const data = await loadData();
    setGoals(data?.storedGoals);
    setWinningStreak(data?.winningStreak);
  };

  const loadData = async () => {
    try {
      const storedGoals = await AsyncStorage.getItem('goals');
      const storedWinningStreak = await AsyncStorage.getItem('winningStreak');

      //first Start or Empty Data
      if (!storedGoals || !storedWinningStreak) {
        console.log('Erster Start der App oder leere Daten');
        const defaultGoals: never[] = [];
        const defaultWinningStreak = 0;
        await AsyncStorage.setItem('goals', JSON.stringify(defaultGoals));
        await AsyncStorage.setItem(
          'winningStreak',
          JSON.stringify(defaultWinningStreak),
        );

        return {
          storedGoals: defaultGoals,
          winningStreak: defaultWinningStreak,
        };
      }

      if (storedGoals && storedWinningStreak) {
        console.log('Daten erfolgreich geladen:', storedGoals);
        const storedGoalsUnparsed = JSON.parse(storedGoals);
        const storedWinningStreakUnparsed = JSON.parse(storedWinningStreak);
        return {
          storedGoals: storedGoalsUnparsed,
          winningStreak: storedWinningStreakUnparsed,
        };
      }
    } catch (error) {
      console.error('Fehler beim Laden der Ziele aus AsyncStorage:', error);
    }
  };

  const saveGoals = async () => {
    try {
      await AsyncStorage.setItem('goals', JSON.stringify(goals));
      console.log('Speichere Ziele:', goals);
    } catch (error) {
      console.error('Fehler beim Speichern der Ziele in AsyncStorage:', error);
    }
  };

  const saveWinningStreak = async () => {
    try {
      await AsyncStorage.setItem(
        'winningStreak',
        JSON.stringify(winningStreak),
      );
      console.log('Speichere winningStreak:', winningStreak);
    } catch (error) {
      console.error(
        'Fehler beim Speichern der winningStreak in AsyncStorage:',
        error,
      );
    }
  };

  const addGoal = () => {
    if (newGoalTitle.trim() !== '' && !isNaN(parseInt(newGoalCount))) {
      const newGoal: Goal = {
        id: Math.random(),
        title: newGoalTitle,
        count: parseInt(newGoalCount),
        originalCount: parseInt(newGoalCount),
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

  const deleteGoal = (id: number) => {
    setGoals(prevGoals => {
      const updatedGoals = prevGoals.filter(goal => goal.id !== id);
      return updatedGoals;
    });
  };

  const resetGoals = () => {
    const resetGoals = goals.map(goal => ({
      ...goal,
      count: goal.originalCount,
      finished: false,
    }));
    setGoals(resetGoals);
    setAllGoalsCompleted(false);
  };

  const decreaseCount = (id: number) => {
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

  const checkDateConditions = () => {
    calculateRemainingTimeTextAndProgressBar();
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    //reset Goals and Deactivate Actionbuttons
    if (currentDay === 1 && currentHour === 0) {
      resetGoals();
    }
    if (currentDay === 0) {
      setDeactivateActionButtons(true);
    } else {
      setDeactivateActionButtons(false);
    }
  };

  const calculateRemainingTimeTextAndProgressBar = () => {
    //Condition for Mondays
    const now = new Date();
    const currentDay = now.getDay();
    const nextMonday = new Date(now);
    nextMonday.setHours(0, 0, 0, 0);
    if (currentDay === 1) {
      nextMonday.setDate(now.getDate() + 7);
    } else {
      nextMonday.setDate(now.getDate() + ((7 - currentDay + 1) % 7 || 7));
    }

    //RemainingTimeText
    const remainingMilliseconds: number = nextMonday.getTime() - now.getTime();
    const remainingDays: number = Math.floor(
      remainingMilliseconds / (1000 * 60 * 60 * 24),
    );
    const remainingHours: number = Math.floor(
      (remainingMilliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const hourStringText = remainingHours === 1 ? 'Stunde' : 'Stunden';
    const timeText =
      remainingDays > 0
        ? `${remainingDays} Tage, ${remainingHours} ${hourStringText}`
        : 'fast geschafft';
    setTimeLeft(timeText);

    //Progressbar
    const totalMillisecondsInWeek: number = 7 * 24 * 60 * 60 * 1000;
    const progressValue: number =
      1 - remainingMilliseconds / totalMillisecondsInWeek;
    setProgress(progressValue);
  };

  const checkIfAllGoalsCompleted = () => {
    const allCompleted = goals.every(goal => goal.finished);
    //AllGoalsCompleted umbenennen
    if (allCompleted && goals.length > 0 && !allGoalsCompleted) {
      setWinningStreak(winningStreak + 1);
      setAllGoalsCompleted(true);
      setShowConfetti(true);
      setTimeout(() => {
        setShowConfetti(false);
      }, 5000);
    }
  };

  const CongratsMessage = () => {
    const messages = [
      'Super! Du hast deine Wochenziele erreicht!',
      'Nicht schlecht, wieder geschafft',
      'Toll gemacht! Deine Wochenziele sind erreicht!',
      'Fantastisch! Du hast deine Ziele für diese Woche erfüllt!',
      `Herzlichen Glückwunsch Meister, schon zum ${winningStreak}x`,
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    return randomMessage;
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
      {/* Überschrift */}
      <Text style={styles.heading}>
        <Animated.Text
          style={{fontSize: 32, color: '#2F4F4F', fontWeight: 'bold'}}>
          Weekly Goals 🎯
        </Animated.Text>
      </Text>

      {/* Konfetti Animation */}
      {showConfetti && (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 9999,
          }}>
          <ConfettiCannon count={200} origin={{x: width / 2, y: height / 2}} />
        </View>
      )}
      {showConfetti && (
        <Animated.View style={styles.fadeText}>
          <Text style={styles.congratsText}>{CongratsMessage()}</Text>
        </Animated.View>
      )}

      {/* Action Button */}
      {deactivateActionButtons ? (
        <>
          <Button
            title={showActionButton ? 'ausblenden' : 'Neue Ziele hinzufügen'}
            color={showActionButton ? 'grey' : ''}
            onPress={() => setShowActionButton(!showActionButton)}
          />
        </>
      ) : (
        <Text>Änderungen der Ziele nur Sonntags möglich.</Text>
      )}

      {/* Eingabefelder für Hinzufügen */}
      {showActionButton && deactivateActionButtons ? (
        <>
          <View style={styles.addDeleteContainer}>
            <TextInput
              style={styles.input}
              placeholder="Ziel"
              value={newGoalTitle}
              onChangeText={setNewGoalTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="Anzahl"
              value={newGoalCount}
              onChangeText={setNewGoalCount}
              keyboardType="numeric"
            />
            <Button title="Ziel hinzufügen" onPress={addGoal} />
          </View>
        </>
      ) : (
        <Text></Text>
      )}

      {/* Zielliste */}
      <FlatList
        data={goals}
        renderItem={renderGoal}
        keyExtractor={item => item.id.toString()}
      />

      {/* Winning Streak */}
      <Text style={styles.text}>Winning streak: {winningStreak}</Text>

      {/* Forschrittstext */}
      <Text style={styles.text}>Verbleibende Zeit bis zum Ende der Woche:</Text>
      <Text style={styles.timeText}>{timeLeft}</Text>

      {/* Fortschrittsbalken */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, {width: `${progress * 100}%`}]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f0f0f0',
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
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
    width: 300,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    padding: 20,
    zIndex: 10,
  },
  congratsText: {
    fontSize: 20,
    color: '#fff',
    textAlign: 'center',
  },
  text: {
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

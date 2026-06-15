package config

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strings"
)

const (
	appEnvKey     = "APP_ENV"
	productionEnv = "production"
)

// LoadDotenvIfNotProduction loads filePath unless APP_ENV=production.
func LoadDotenvIfNotProduction(filePath string) error {
	if strings.EqualFold(strings.TrimSpace(os.Getenv(appEnvKey)), productionEnv) {
		return nil
	}
	if err := LoadDotenv(filePath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

// LoadDotenv loads KEY=value pairs without overwriting existing environment.
func LoadDotenv(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	lineNo := 0
	for scanner.Scan() {
		lineNo++
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			return fmt.Errorf("%s:%d: expected KEY=value", filePath, lineNo)
		}
		key = strings.TrimSpace(key)
		if key == "" {
			return fmt.Errorf("%s:%d: empty key", filePath, lineNo)
		}
		if _, exists := os.LookupEnv(key); exists {
			continue
		}
		value = strings.TrimSpace(value)
		value = strings.Trim(value, `"'`)
		if err := os.Setenv(key, value); err != nil {
			return fmt.Errorf("set %s: %w", key, err)
		}
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read %s: %w", filePath, err)
	}
	return nil
}
